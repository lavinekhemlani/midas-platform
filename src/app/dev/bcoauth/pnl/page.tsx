'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'
import { fmt } from '../_shared/components'
import { formatPnLCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { ReactECharts } from '@/components/chat/visualizations/shared/ReactEChartsWrapper'
import { EChartsWorldMap } from '@/components/charts/echarts'

// ── P&L Statement Row ─────────────────────────────────────────────────────────

function PnLStatementRow({ line, currency }: { line: any; currency: string }) {
  const isTotal = line.lineType === 'total'
  const isHeader = line.lineType === 'header'
  const isComputed = line.lineType === 'computed'
  const isSpacer = line.lineType === 'spacer'
  const indent = (line.indentation || 0) * 20
  const showAmount =
    !isHeader &&
    !isSpacer &&
    line.netChange != null &&
    (line.netChange !== 0 || isTotal || isComputed)

  if (isSpacer) return <div className="h-3" />

  return (
    <div
      className={`flex items-center justify-between px-6 py-2 transition-colors ${
        isComputed
          ? 'font-bold border-t-2 border-gray-400/30 bg-white/[0.03] mt-1'
          : isTotal
            ? 'font-semibold border-t border-gray-200/10 bg-white/[0.01]'
            : isHeader
              ? 'font-medium pt-3'
              : 'hover:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-1 flex-1 min-w-0" style={{ paddingLeft: indent }}>
        {!isTotal && !isHeader && !isComputed && (
          <span className="w-3 h-3 text-white/20 flex-shrink-0 text-xs">&#8250;</span>
        )}
        <span
          className={`text-sm truncate ${
            isComputed || isTotal || isHeader ? 'theme-text-primary' : 'theme-text-secondary'
          } ${isComputed ? 'text-base' : ''}`}
        >
          {line.display}
        </span>
      </div>
      {showAmount && (
        <span
          className={`text-sm font-mono tabular-nums whitespace-nowrap ml-4 ${
            isComputed
              ? line.netChange >= 0
                ? 'text-emerald-400 font-bold text-base'
                : 'text-red-400 font-bold text-base'
              : isTotal
                ? 'theme-text-primary font-semibold'
                : line.netChange < 0
                  ? 'text-red-400'
                  : 'theme-text-secondary'
          }`}
        >
          {formatPnLCurrency(line.netChange, currency)}
        </span>
      )}
    </div>
  )
}

// ── Diagnostic Tests ──────────────────────────────────────────────────────────

const DIAGNOSTIC_TESTS = [
  {
    id: 'entity-probe',
    label: 'Entity Availability',
    description: 'Probes all BC API entities to see which are available',
  },
  {
    id: 'company-info',
    label: 'Company Info',
    description: 'Company name, currency, country, tax registration',
  },
  {
    id: 'balance-sheet',
    label: 'Balance Sheet',
    description: 'Assets, Liabilities, Equity from accounts + GL entries',
  },
  {
    id: 'monthly-pnl',
    label: 'Monthly P&L Trend',
    description: 'Revenue, COGS, Expenses by month with margins',
  },
  {
    id: 'health-score',
    label: 'Financial Health',
    description: 'Health score, cash runway, margins, burn rate',
  },
  { id: 'customers', label: 'Customers', description: 'Customer list with AR balances' },
  { id: 'vendors', label: 'Vendors', description: 'Vendor list with AP balances' },
  {
    id: 'aged-ar',
    label: 'Aged Receivables',
    description: 'AR aging buckets (current, 30, 60, 90+ days)',
  },
  {
    id: 'aged-ap',
    label: 'Aged Payables',
    description: 'AP aging buckets (current, 30, 60, 90+ days)',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Items with stock levels and estimated values',
  },
  { id: 'bank-accounts', label: 'Bank Accounts', description: 'Bank accounts with balances' },
  { id: 'invoices', label: 'Invoices', description: 'Recent sales and purchase invoices' },
  {
    id: 'efficiency',
    label: 'Efficiency Metrics',
    description: 'DSO, DPO, Inventory Turnover, Cash Conversion Cycle',
  },
  {
    id: 'enhanced-data',
    label: 'Enhanced Financial Data',
    description:
      'Aggregated dashboard data: top customers/vendors, aged AR/AP, ratios, bank accounts, efficiency, cash runway, inventory',
    customRoute: '/api/providers/dynamics/enhanced-financial-data',
  },
  {
    id: 'monthly-trend',
    label: 'Monthly P&L Trend (New Route)',
    description:
      'Monthly P&L breakdown from GL entries: revenue, COGS, expenses, net income per month',
    customRoute: '/api/providers/dynamics/monthly-pnl-trend',
  },
]

// ── P&L Tab Enum ──────────────────────────────────────────────────────────────

type PnLTab = 'preview' | 'diagnostics' | 'sales-geography' | 'full-diagnostic'

// ── Main Page Component ───────────────────────────────────────────────────────

export default function BCOAuthPnLPage() {
  const { connectionId, startDate, endDate } = useBCOAuthDev()
  const [activeTab, setActiveTab] = useState<PnLTab>('preview')

  return (
    <div className="space-y-6">
      {/* Sub-Tab Switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
        {[
          { id: 'preview' as const, label: 'P&L Preview' },
          { id: 'diagnostics' as const, label: 'P&L Diagnostics' },
          { id: 'sales-geography' as const, label: 'Sales Geography' },
          { id: 'full-diagnostic' as const, label: 'Full Diagnostic' },
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

      {activeTab === 'preview' && (
        <PnLPreviewSection connectionId={connectionId} startDate={startDate} endDate={endDate} />
      )}

      {activeTab === 'diagnostics' && (
        <PnLDiagnosticsSection
          connectionId={connectionId}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeTab === 'sales-geography' && (
        <SalesGeographySection
          connectionId={connectionId}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeTab === 'full-diagnostic' && (
        <FullDiagnosticSection
          connectionId={connectionId}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  )
}

// ── P&L Preview Section ───────────────────────────────────────────────────────

function PnLPreviewSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [pnlData, setPnlData] = useState<any>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [fetchedDates, setFetchedDates] = useState<{ start: string; end: string } | null>(null)

  const fetchPnL = useCallback(async () => {
    if (!connectionId) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ connectionId, mode: 'pnl' })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const t0 = Date.now()
    try {
      const res = await fetch(`/api/supervisor/dynamics/income-statement-test?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setPnlData(json.data)
        setDebugInfo(json._debug)
        setFetchedDates({ start: startDate, end: endDate })
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, startDate, endDate])

  useEffect(() => {
    if (!pnlData || loading) return
    if (fetchedDates && (fetchedDates.start !== startDate || fetchedDates.end !== endDate)) {
      fetchPnL()
    }
  }, [startDate, endDate, pnlData, loading, fetchedDates, fetchPnL])

  const currency = pnlData?.currency || 'USD'
  const totals = pnlData?.totals
  const lines = pnlData?.lines || []

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
      {/* Fetch Button */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={fetchPnL}
          disabled={!connectionId || loading}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading P&L...' : pnlData ? 'Reload P&L' : 'Load P&L Statement'}
        </button>
        {durationMs != null && <span className="text-xs theme-text-secondary">{durationMs}ms</span>}
        {pnlData?.source && (
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            Source: {pnlData.source}
          </span>
        )}
        {pnlData?.dateFiltered != null && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              pnlData.dateFiltered
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {pnlData.dateFiltered ? 'Date filter applied' : 'All-time (date filter not supported)'}
          </span>
        )}
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono space-y-2">
          <p className="text-blue-400 font-semibold mb-2">Debug: Account Analysis</p>
          <p className="theme-text-secondary">
            Categories:{' '}
            <span className="text-blue-300">{JSON.stringify(debugInfo.categoryCounts)}</span>
          </p>
          <p className="theme-text-secondary">
            Account Types:{' '}
            <span className="text-blue-300">{JSON.stringify(debugInfo.accountTypeCounts)}</span>
          </p>
          <p className="theme-text-secondary">
            P&L accounts included:{' '}
            <span className="text-blue-300">{debugInfo.plAccountsIncluded}</span> of{' '}
            {debugInfo.totalAccounts} total
          </p>
          {debugInfo.missingAccountSearch?.length > 0 && (
            <div className="mt-2 border-t border-blue-500/20 pt-2">
              <p className="text-amber-400 font-semibold mb-1">
                Search for &quot;missing&quot; accounts (FBA, Stripe, Advertising, etc.):
              </p>
              {debugInfo.missingAccountSearch.map((acc: any, i: number) => (
                <p key={i} className="theme-text-secondary">
                  <span className="text-blue-300">{acc.number}</span>{' '}
                  <span className="theme-text-primary">{acc.displayName}</span> | category:{' '}
                  <span
                    className={
                      acc.categoryDecoded === 'Cost of Goods Sold' ||
                      acc.categoryDecoded === 'Expense' ||
                      acc.categoryDecoded === 'Income'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }
                  >
                    {acc.categoryDecoded || '(empty)'}
                  </span>{' '}
                  | type:{' '}
                  <span className="text-blue-300">{acc.accountTypeDecoded || '(empty)'}</span> |
                  sub: <span className="text-blue-300">{acc.subCategory || '(empty)'}</span>
                </p>
              ))}
            </div>
          )}
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

      {!loading && pnlData && (
        <>
          {totals && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Revenue', value: totals.totalRevenue, color: 'text-emerald-400' },
                { label: 'COGS', value: -totals.totalCOGS, color: 'text-red-400' },
                { label: 'Gross Profit', value: totals.grossProfit, color: '' },
                { label: 'Expenses', value: -totals.totalExpenses, color: 'text-red-400' },
                {
                  label: 'Net Income',
                  value: totals.netIncome,
                  color: totals.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400',
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

          <div className="glass-luxury-card border border-gray-200/10 rounded-xl overflow-hidden">
            <div className="px-6 pt-5 pb-3">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-light font-serif italic theme-text-primary">
                  P&L Statement
                </h2>
                {pnlData.companyName && (
                  <p className="text-sm theme-text-secondary">{pnlData.companyName}</p>
                )}
                {(startDate || endDate) && (
                  <div className="flex items-center justify-center gap-2 text-xs theme-text-secondary">
                    <span className="font-serif italic">from</span>
                    <span>{fmtDate(startDate) || 'beginning'}</span>
                    <span className="font-serif italic">to</span>
                    <span>{fmtDate(endDate) || 'now'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200/10">
              <span className="text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Account
              </span>
              <span className="text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Total
              </span>
            </div>

            {lines.length > 0 ? (
              <div className="divide-y divide-gray-200/5">
                {lines.map((line: any, i: number) => (
                  <PnLStatementRow key={line.lineNumber ?? i} line={line} currency={currency} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px]">
                <p className="text-sm theme-text-secondary">No data</p>
              </div>
            )}

            <div className="px-6 py-3 border-t border-gray-200/10">
              <div className="flex items-center justify-between text-xs theme-text-secondary">
                <span>Source: accounts CRUD (native Begin/End-Total hierarchy)</span>
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
          </div>
        </>
      )}
    </div>
  )
}

// ── P&L Diagnostics Section (Comprehensive — inventory-test style) ──────────

function PnLDiagnosticsSection({
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
      const res = await fetch(`/api/providers/dynamics/income-statement-test?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setData(json)
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, startDate, endDate])

  const entityProbe = data?.entityProbe
  const accountAnalysis = data?.accountAnalysis
  const statementTests = data?.statementTests
  const revenueAnalysis = data?.revenueAnalysis
  const expenseAnalysis = data?.expenseAnalysis
  const customerVendorAnalysis = data?.customerVendorAnalysis
  const dimensionalAnalysis = data?.dimensionalAnalysis
  const monthlyTrend = data?.monthlyTrend

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={fetchData}
          disabled={!connectionId || loading}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Probing P&L Entities...'
            : data
              ? 'Re-run P&L Diagnostic'
              : 'Run P&L Diagnostic'}
        </button>
        {durationMs != null && (
          <span className="text-xs theme-text-secondary">{durationMs}ms total</span>
        )}
        {data?.durationMs != null && (
          <span className="text-xs theme-text-secondary">({data.durationMs}ms server)</span>
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
            <p className="text-sm theme-text-secondary">Probing BC API entities for P&L data...</p>
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
          {/* ── Entity Availability Probe ── */}
          {entityProbe && (
            <div className="glass-luxury-card p-5 space-y-4">
              <button
                onClick={() => toggleSection('entity-probe')}
                className="flex items-center gap-2 w-full text-left"
              >
                {expandedSections['entity-probe'] ? (
                  <ChevronDown className="w-4 h-4 theme-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 theme-text-secondary" />
                )}
                <h3 className="text-base font-semibold theme-text-primary">
                  Entity Availability Probe
                </h3>
                <span className="text-xs theme-text-secondary ml-2">
                  {Object.values(entityProbe).filter((e: any) => e.available).length} available,{' '}
                  {Object.values(entityProbe).filter((e: any) => !e.available).length} unavailable
                </span>
              </button>

              {expandedSections['entity-probe'] && (
                <div className="grid gap-2 mt-3">
                  {Object.entries(entityProbe).map(([name, info]: [string, any]) => (
                    <div
                      key={name}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        info.available
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-red-500/20 bg-red-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            info.available ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="font-mono text-sm theme-text-primary">{name}</span>
                          <p className="text-xs theme-text-secondary">{info.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        {info.available ? (
                          <>
                            <span className="theme-text-secondary">{info.durationMs}ms</span>
                            <span className="text-emerald-400">
                              {info.fields?.length || 0} fields
                            </span>
                          </>
                        ) : (
                          <span className="text-red-400 max-w-[200px] truncate">{info.error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Field Discovery ── */}
          {entityProbe && (
            <div className="glass-luxury-card p-5 space-y-4">
              <button
                onClick={() => toggleSection('field-discovery')}
                className="flex items-center gap-2 w-full text-left"
              >
                {expandedSections['field-discovery'] ? (
                  <ChevronDown className="w-4 h-4 theme-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 theme-text-secondary" />
                )}
                <h3 className="text-base font-semibold theme-text-primary">Field Discovery</h3>
                <span className="text-xs theme-text-secondary ml-2">
                  Available fields per entity + sample record
                </span>
              </button>

              {expandedSections['field-discovery'] && (
                <div className="space-y-4 mt-3">
                  {Object.entries(entityProbe)
                    .filter(([, info]: [string, any]) => info.available && info.fields?.length > 0)
                    .map(([name, info]: [string, any]) => (
                      <div key={name} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <button
                          onClick={() => toggleSection(`fields-${name}`)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          {expandedSections[`fields-${name}`] ? (
                            <ChevronDown className="w-3.5 h-3.5 theme-text-secondary" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 theme-text-secondary" />
                          )}
                          <span className="font-mono text-sm font-medium theme-text-primary">
                            {name}
                          </span>
                          <span className="text-xs theme-text-secondary">
                            ({info.fields.length} fields)
                          </span>
                        </button>

                        {expandedSections[`fields-${name}`] && (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                              {info.fields.map((field: string) => (
                                <span
                                  key={field}
                                  className="px-2 py-0.5 text-xs font-mono rounded bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                            {info.sampleRecord && (
                              <div>
                                <p className="text-xs theme-text-secondary mb-1 font-medium">
                                  Sample Record:
                                </p>
                                <pre className="p-3 rounded bg-black/30 text-xs font-mono theme-text-primary overflow-x-auto max-h-[300px] overflow-y-auto">
                                  {JSON.stringify(info.sampleRecord, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── Account Analysis ── */}
          {accountAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Chart of Accounts Analysis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Accounts', value: accountAnalysis.totalAccounts },
                  { label: 'P&L Accounts', value: accountAnalysis.plAccountCount },
                  { label: 'Posting Accounts', value: accountAnalysis.postingCount },
                  {
                    label: 'Non-P&L',
                    value: accountAnalysis.totalAccounts - accountAnalysis.plAccountCount,
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      {card.label}
                    </p>
                    <p className="text-sm font-semibold theme-text-primary mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Category & Type breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <button
                    onClick={() => toggleSection('by-category')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['by-category'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    By Category ({Object.keys(accountAnalysis.categoryCounts).length})
                  </button>
                  {expandedSections['by-category'] && (
                    <div className="space-y-1">
                      {Object.entries(accountAnalysis.categoryCounts)
                        .sort(([, a]: any, [, b]: any) => b - a)
                        .map(([cat, count]: any) => (
                          <div key={cat} className="flex items-center justify-between text-xs">
                            <span
                              className={
                                ['Income', 'Expense', 'Cost of Goods Sold'].includes(cat)
                                  ? 'text-emerald-400'
                                  : 'theme-text-secondary'
                              }
                            >
                              {cat}
                            </span>
                            <span className="font-mono theme-text-secondary">{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => toggleSection('by-type')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['by-type'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    By Account Type ({Object.keys(accountAnalysis.accountTypeCounts).length})
                  </button>
                  {expandedSections['by-type'] && (
                    <div className="space-y-1">
                      {Object.entries(accountAnalysis.accountTypeCounts)
                        .sort(([, a]: any, [, b]: any) => b - a)
                        .map(([type, count]: any) => (
                          <div key={type} className="flex items-center justify-between text-xs">
                            <span className="theme-text-secondary">{type}</span>
                            <span className="font-mono theme-text-secondary">{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* P&L SubCategory breakdown */}
              {accountAnalysis.subCategoryCounts?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('by-subcategory')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['by-subcategory'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    P&L SubCategories ({accountAnalysis.subCategoryCounts.length})
                  </button>
                  {expandedSections['by-subcategory'] && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {accountAnalysis.subCategoryCounts.map((sc: any) => (
                        <div key={sc.path} className="flex items-center justify-between text-xs">
                          <span className="theme-text-secondary truncate mr-2">{sc.path}</span>
                          <span className="font-mono theme-text-secondary flex-shrink-0">
                            {sc.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Statement Method Comparison ── */}
          {statementTests && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                P&L Statement Tests ({statementTests.length} methods)
              </h3>
              <div className="space-y-3">
                {statementTests.map((test: any, i: number) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${
                      test.error
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-emerald-500/20 bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium theme-text-primary">{test.method}</span>
                      <span className="text-xs theme-text-secondary">
                        {test.durationMs}ms | {test.linesBuilt} lines
                      </span>
                    </div>
                    <p className="text-xs theme-text-secondary mb-2">{test.description}</p>
                    {test.error && <p className="text-xs text-red-400">{test.error}</p>}
                    {test.totals && (
                      <div className="grid grid-cols-5 gap-2 mt-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-secondary">
                            Revenue
                          </span>
                          <p className="text-sm font-mono text-emerald-400">
                            {fmt(test.totals.totalRevenue)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-secondary">
                            COGS
                          </span>
                          <p className="text-sm font-mono text-red-400">
                            {fmt(test.totals.totalCOGS)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-secondary">
                            Gross Profit
                          </span>
                          <p className="text-sm font-mono theme-text-primary">
                            {fmt(test.totals.grossProfit)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-secondary">
                            Expenses
                          </span>
                          <p className="text-sm font-mono text-red-400">
                            {fmt(test.totals.totalExpenses)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-secondary">
                            Net Income
                          </span>
                          <p
                            className={`text-sm font-mono font-semibold ${test.totals.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                          >
                            {fmt(test.totals.netIncome)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Revenue Analysis ── */}
          {revenueAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Revenue Analysis
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  {fmt(revenueAnalysis.totalRevenue)} total
                </span>
              </h3>

              {revenueAnalysis.bySubCategory?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('rev-subcat')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['rev-subcat'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    By SubCategory ({revenueAnalysis.bySubCategory.length})
                  </button>
                  {expandedSections['rev-subcat'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">
                              SubCategory
                            </th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Amount</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Accounts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueAnalysis.bySubCategory.map((sc: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 theme-text-primary">{sc.subCategory}</td>
                              <td className="py-1 px-2 text-right font-mono text-emerald-400">
                                {fmt(sc.amount)}
                              </td>
                              <td className="py-1 px-2 text-right theme-text-secondary">
                                {sc.accountCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {revenueAnalysis.topAccounts?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('rev-top')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['rev-top'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Top Revenue Accounts ({revenueAnalysis.topAccounts.length})
                  </button>
                  {expandedSections['rev-top'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">Account</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Name</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueAnalysis.topAccounts.map((acc: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 font-mono theme-text-secondary">
                                {acc.number}
                              </td>
                              <td className="py-1 px-2 theme-text-primary truncate max-w-[250px]">
                                {acc.name}
                              </td>
                              <td className="py-1 px-2 text-right font-mono text-emerald-400">
                                {fmt(acc.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sales by customer — with city/state/country */}
              {revenueAnalysis.salesByCustomer?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('sales-by-customer')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['sales-by-customer'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Sales by Customer ({revenueAnalysis.salesByCustomer.length})
                  </button>
                  {expandedSections['sales-by-customer'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">Code</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Customer</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">State</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Country</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Invoices</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueAnalysis.salesByCustomer.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 font-mono theme-text-secondary">
                                {c.customerNumber}
                              </td>
                              <td className="py-1 px-2 theme-text-primary truncate max-w-[200px]">
                                {c.name}
                              </td>
                              <td className="py-1 px-2 theme-text-secondary">{c.city || '-'}</td>
                              <td className="py-1 px-2 theme-text-secondary">{c.state || '-'}</td>
                              <td className="py-1 px-2 theme-text-secondary">{c.country || '-'}</td>
                              <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                                {c.invoiceCount}
                              </td>
                              <td className="py-1 px-2 text-right font-mono text-emerald-400">
                                {fmt(c.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Expense Analysis ── */}
          {expenseAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Expense Analysis
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  {fmt(expenseAnalysis.totalExpenses)} total
                </span>
              </h3>

              {expenseAnalysis.bySubCategory?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('exp-subcat')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['exp-subcat'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    By SubCategory ({expenseAnalysis.bySubCategory.length})
                  </button>
                  {expandedSections['exp-subcat'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">
                              SubCategory
                            </th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Amount</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Accounts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseAnalysis.bySubCategory.map((sc: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 theme-text-primary">{sc.subCategory}</td>
                              <td className="py-1 px-2 text-right font-mono text-red-400">
                                {fmt(sc.amount)}
                              </td>
                              <td className="py-1 px-2 text-right theme-text-secondary">
                                {sc.accountCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {expenseAnalysis.topAccounts?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('exp-top')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['exp-top'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Top Expense Accounts ({expenseAnalysis.topAccounts.length})
                  </button>
                  {expandedSections['exp-top'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">Account</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Name</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Category</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseAnalysis.topAccounts.map((acc: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 font-mono theme-text-secondary">
                                {acc.number}
                              </td>
                              <td className="py-1 px-2 theme-text-primary truncate max-w-[200px]">
                                {acc.name}
                              </td>
                              <td className="py-1 px-2 theme-text-secondary text-[11px]">
                                {acc.category}
                              </td>
                              <td className="py-1 px-2 text-right font-mono text-red-400">
                                {fmt(acc.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Purchases by vendor — with city/state/country */}
              {expenseAnalysis.purchasesByVendor?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('purchases-by-vendor')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['purchases-by-vendor'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Purchases by Vendor ({expenseAnalysis.purchasesByVendor.length})
                  </button>
                  {expandedSections['purchases-by-vendor'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">Code</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Vendor</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">State</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Country</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Invoices</th>
                            <th className="text-right py-1 px-2 theme-text-secondary">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseAnalysis.purchasesByVendor.map((v: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 font-mono theme-text-secondary">
                                {v.vendorNumber}
                              </td>
                              <td className="py-1 px-2 theme-text-primary truncate max-w-[200px]">
                                {v.name}
                              </td>
                              <td className="py-1 px-2 theme-text-secondary">{v.city || '-'}</td>
                              <td className="py-1 px-2 theme-text-secondary">{v.state || '-'}</td>
                              <td className="py-1 px-2 theme-text-secondary">{v.country || '-'}</td>
                              <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                                {v.invoiceCount}
                              </td>
                              <td className="py-1 px-2 text-right font-mono text-red-400">
                                {fmt(v.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Customer & Vendor Deep Analysis ── */}
          {customerVendorAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Customer & Vendor Analysis
              </h3>

              {/* Customer analysis */}
              {customerVendorAnalysis.customers && !customerVendorAnalysis.customers.error && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium theme-text-primary">
                      Customers ({customerVendorAnalysis.customers.totalCount})
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                      {customerVendorAnalysis.customers.addressFields?.length || 0} address fields
                      found
                    </span>
                  </div>

                  {/* Discovered address fields */}
                  {customerVendorAnalysis.customers.addressFields?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium theme-text-secondary mb-1">
                        Address/Location Fields:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {customerVendorAnalysis.customers.addressFields.map((f: string) => (
                          <span
                            key={f}
                            className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All fields discovery */}
                  <div>
                    <button
                      onClick={() => toggleSection('customer-all-fields')}
                      className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                    >
                      {expandedSections['customer-all-fields'] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      All Customer Fields ({customerVendorAnalysis.customers.allFields?.length || 0}
                      )
                    </button>
                    {expandedSections['customer-all-fields'] && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {customerVendorAnalysis.customers.allFields?.map((f: string) => (
                            <span
                              key={f}
                              className={`px-2 py-0.5 text-xs font-mono rounded border ${
                                customerVendorAnalysis.customers.addressFields?.includes(f)
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                        {customerVendorAnalysis.customers.sampleCustomer && (
                          <div>
                            <p className="text-xs theme-text-secondary mb-1 font-medium">
                              Sample Customer:
                            </p>
                            <pre className="p-3 rounded bg-black/30 text-xs font-mono theme-text-primary overflow-x-auto max-h-[300px] overflow-y-auto">
                              {JSON.stringify(
                                customerVendorAnalysis.customers.sampleCustomer,
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customers by city */}
                  {customerVendorAnalysis.customers.byCity?.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleSection('cust-by-city')}
                        className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                      >
                        {expandedSections['cust-by-city'] ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        Customers by City ({customerVendorAnalysis.customers.byCity.length})
                      </button>
                      {expandedSections['cust-by-city'] && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                                <th className="text-right py-1 px-2 theme-text-secondary">Count</th>
                                <th className="text-left py-1 px-2 theme-text-secondary">
                                  Sample Customers
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerVendorAnalysis.customers.byCity.map((c: any, i: number) => (
                                <tr key={i} className="hover:bg-white/5">
                                  <td className="py-1 px-2 theme-text-primary">{c.city}</td>
                                  <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                                    {c.count}
                                  </td>
                                  <td className="py-1 px-2 theme-text-secondary text-[11px] truncate max-w-[300px]">
                                    {c.customers?.join(', ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Customers by country */}
                  {customerVendorAnalysis.customers.byCountry?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs theme-text-secondary">By Country:</span>
                      {customerVendorAnalysis.customers.byCountry.map((c: any) => (
                        <span
                          key={c.country}
                          className="px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 theme-text-primary"
                        >
                          {c.country}: <span className="font-semibold">{c.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {customerVendorAnalysis.customers?.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">
                    Customer analysis error: {customerVendorAnalysis.customers.error}
                  </p>
                </div>
              )}

              {/* Vendor analysis */}
              {customerVendorAnalysis.vendors && !customerVendorAnalysis.vendors.error && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium theme-text-primary">
                      Vendors ({customerVendorAnalysis.vendors.totalCount})
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                      {customerVendorAnalysis.vendors.addressFields?.length || 0} address fields
                      found
                    </span>
                  </div>

                  {customerVendorAnalysis.vendors.addressFields?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium theme-text-secondary mb-1">
                        Address/Location Fields:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {customerVendorAnalysis.vendors.addressFields.map((f: string) => (
                          <span
                            key={f}
                            className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <button
                      onClick={() => toggleSection('vendor-all-fields')}
                      className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                    >
                      {expandedSections['vendor-all-fields'] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      All Vendor Fields ({customerVendorAnalysis.vendors.allFields?.length || 0})
                    </button>
                    {expandedSections['vendor-all-fields'] && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {customerVendorAnalysis.vendors.allFields?.map((f: string) => (
                            <span
                              key={f}
                              className={`px-2 py-0.5 text-xs font-mono rounded border ${
                                customerVendorAnalysis.vendors.addressFields?.includes(f)
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                        {customerVendorAnalysis.vendors.sampleVendor && (
                          <div>
                            <p className="text-xs theme-text-secondary mb-1 font-medium">
                              Sample Vendor:
                            </p>
                            <pre className="p-3 rounded bg-black/30 text-xs font-mono theme-text-primary overflow-x-auto max-h-[300px] overflow-y-auto">
                              {JSON.stringify(customerVendorAnalysis.vendors.sampleVendor, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {customerVendorAnalysis.vendors.byCity?.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleSection('vend-by-city')}
                        className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                      >
                        {expandedSections['vend-by-city'] ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        Vendors by City ({customerVendorAnalysis.vendors.byCity.length})
                      </button>
                      {expandedSections['vend-by-city'] && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                                <th className="text-right py-1 px-2 theme-text-secondary">Count</th>
                                <th className="text-left py-1 px-2 theme-text-secondary">
                                  Sample Vendors
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerVendorAnalysis.vendors.byCity.map((v: any, i: number) => (
                                <tr key={i} className="hover:bg-white/5">
                                  <td className="py-1 px-2 theme-text-primary">{v.city}</td>
                                  <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                                    {v.count}
                                  </td>
                                  <td className="py-1 px-2 theme-text-secondary text-[11px] truncate max-w-[300px]">
                                    {v.vendors?.join(', ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sales invoice lines probe */}
              {customerVendorAnalysis.salesInvoiceLines && (
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => toggleSection('sales-lines')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['sales-lines'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Sales Invoice Lines Fields (
                    {customerVendorAnalysis.salesInvoiceLines.fields?.length || 0})
                  </button>
                  {expandedSections['sales-lines'] && (
                    <div className="space-y-3">
                      {customerVendorAnalysis.salesInvoiceLines.fields?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {customerVendorAnalysis.salesInvoiceLines.fields.map((f: string) => (
                            <span
                              key={f}
                              className="px-2 py-0.5 text-xs font-mono rounded bg-blue-500/10 text-blue-300 border border-blue-500/20"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                      {customerVendorAnalysis.salesInvoiceLines.sampleRecord && (
                        <div>
                          <p className="text-xs theme-text-secondary mb-1 font-medium">
                            Sample Sales Invoice Line:
                          </p>
                          <pre className="p-3 rounded bg-black/30 text-xs font-mono theme-text-primary overflow-x-auto max-h-[300px] overflow-y-auto">
                            {JSON.stringify(
                              customerVendorAnalysis.salesInvoiceLines.sampleRecord,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Dimensional Analysis ── */}
          {dimensionalAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Dimensional Analysis
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  {dimensionalAnalysis.dimensions?.length ?? 0} dimensions |{' '}
                  {dimensionalAnalysis.locations?.length ?? 0} locations
                </span>
              </h3>

              {dimensionalAnalysis.dimensions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium theme-text-secondary mb-2">
                    Available Dimensions
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {dimensionalAnalysis.dimensions.map((d: any) => (
                      <div
                        key={d.id || d.code}
                        className="p-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <span className="text-sm font-medium theme-text-primary">
                          {d.displayName || d.code}
                        </span>
                        <p className="text-xs theme-text-secondary font-mono">{d.code}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dimensionalAnalysis.dimensionValues &&
                Object.keys(dimensionalAnalysis.dimensionValues).length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleSection('dim-values')}
                      className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                    >
                      {expandedSections['dim-values'] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      Dimension Values ({Object.keys(dimensionalAnalysis.dimensionValues).length}{' '}
                      dimensions)
                    </button>
                    {expandedSections['dim-values'] &&
                      Object.entries(dimensionalAnalysis.dimensionValues).map(
                        ([dimCode, values]: [string, any]) => (
                          <div key={dimCode} className="mb-2">
                            <p className="text-xs font-medium text-blue-400 mb-1">{dimCode}</p>
                            <div className="flex flex-wrap gap-1">
                              {values.slice(0, 20).map((v: any, i: number) => (
                                <span
                                  key={i}
                                  className="text-[11px] px-2 py-0.5 rounded bg-white/10 theme-text-secondary"
                                >
                                  {v.displayName || v.code}
                                </span>
                              ))}
                              {values.length > 20 && (
                                <span className="text-[11px] px-2 py-0.5 theme-text-secondary">
                                  +{values.length - 20} more
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}

              {dimensionalAnalysis.revenueGLLinking && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-xs font-medium text-blue-400 mb-2">
                    Revenue GL - Dimension Linking
                  </h4>
                  {dimensionalAnalysis.revenueGLLinking.error ? (
                    <p className="text-xs text-red-400">
                      {dimensionalAnalysis.revenueGLLinking.error}
                    </p>
                  ) : (
                    <div className="space-y-1 text-xs">
                      <p className="theme-text-secondary">
                        Revenue GL entries:{' '}
                        <span className="font-mono theme-text-primary">
                          {dimensionalAnalysis.revenueGLLinking.totalRevenueGLEntries}
                        </span>
                      </p>
                      <p className="theme-text-secondary">
                        With dimensionSetID:{' '}
                        <span className="font-mono theme-text-primary">
                          {dimensionalAnalysis.revenueGLLinking.withDimensionSetID}
                        </span>
                      </p>
                      <p className="theme-text-secondary">
                        Linkage rate:{' '}
                        <span
                          className={`font-mono font-semibold ${
                            dimensionalAnalysis.revenueGLLinking.linkageRate !== 'N/A' &&
                            parseInt(dimensionalAnalysis.revenueGLLinking.linkageRate) > 50
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {dimensionalAnalysis.revenueGLLinking.linkageRate}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {dimensionalAnalysis.locations?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('dim-locations')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['dim-locations'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Locations ({dimensionalAnalysis.locations.length})
                  </button>
                  {expandedSections['dim-locations'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1 px-2 theme-text-secondary">Code</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">Name</th>
                            <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dimensionalAnalysis.locations.map((loc: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="py-1 px-2 font-mono theme-text-secondary">
                                {loc.code}
                              </td>
                              <td className="py-1 px-2 theme-text-primary">{loc.displayName}</td>
                              <td className="py-1 px-2 theme-text-secondary">{loc.city || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {dimensionalAnalysis.dimensionSetEntriesFields?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('dim-set-fields')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['dim-set-fields'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    dimensionSetEntries Fields (
                    {dimensionalAnalysis.dimensionSetEntriesFields.length})
                  </button>
                  {expandedSections['dim-set-fields'] && (
                    <div className="flex flex-wrap gap-1">
                      {dimensionalAnalysis.dimensionSetEntriesFields.map((f: string) => (
                        <span
                          key={f}
                          className="text-[11px] px-2 py-0.5 rounded bg-white/10 font-mono theme-text-secondary"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Monthly P&L Trend ── */}
          {monthlyTrend?.length > 0 && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Monthly P&L Trend ({monthlyTrend.length} months)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-1.5 px-2 theme-text-secondary">Month</th>
                      <th className="text-right py-1.5 px-2 text-emerald-400">Revenue</th>
                      <th className="text-right py-1.5 px-2 text-red-400">COGS</th>
                      <th className="text-right py-1.5 px-2 theme-text-secondary">Gross Profit</th>
                      <th className="text-right py-1.5 px-2 text-red-400">Expenses</th>
                      <th className="text-right py-1.5 px-2 theme-text-secondary">Net Income</th>
                      <th className="text-right py-1.5 px-2 theme-text-secondary">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="py-1 px-2 font-mono theme-text-primary">{m.month}</td>
                        <td className="py-1 px-2 text-right font-mono text-emerald-400">
                          {fmt(m.revenue)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-red-400">
                          -{fmt(m.cogs)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono theme-text-primary">
                          {fmt(m.grossProfit)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-red-400">
                          -{fmt(m.expenses)}
                        </td>
                        <td
                          className={`py-1 px-2 text-right font-mono font-semibold ${m.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {fmt(m.netIncome)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                          {m.revenue > 0 ? `${Math.round((m.netIncome / m.revenue) * 100)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-white/20 font-semibold">
                      <td className="py-1.5 px-2 theme-text-primary">Total</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-400">
                        {fmt(monthlyTrend.reduce((s: number, m: any) => s + m.revenue, 0))}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-red-400">
                        -{fmt(monthlyTrend.reduce((s: number, m: any) => s + m.cogs, 0))}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono theme-text-primary">
                        {fmt(monthlyTrend.reduce((s: number, m: any) => s + m.grossProfit, 0))}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-red-400">
                        -{fmt(monthlyTrend.reduce((s: number, m: any) => s + m.expenses, 0))}
                      </td>
                      <td
                        className={`py-1.5 px-2 text-right font-mono font-bold ${
                          monthlyTrend.reduce((s: number, m: any) => s + m.netIncome, 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {fmt(monthlyTrend.reduce((s: number, m: any) => s + m.netIncome, 0))}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono theme-text-secondary">
                        {(() => {
                          const totalRev = monthlyTrend.reduce(
                            (s: number, m: any) => s + m.revenue,
                            0
                          )
                          const totalNet = monthlyTrend.reduce(
                            (s: number, m: any) => s + m.netIncome,
                            0
                          )
                          return totalRev > 0 ? `${Math.round((totalNet / totalRev) * 100)}%` : '-'
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Raw JSON ── */}
          <div className="glass-luxury-card p-5 space-y-3">
            <button
              onClick={() => toggleSection('raw-json')}
              className="flex items-center gap-2 w-full text-left"
            >
              {expandedSections['raw-json'] ? (
                <ChevronDown className="w-4 h-4 theme-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 theme-text-secondary" />
              )}
              <h3 className="text-base font-semibold theme-text-primary">Raw JSON Response</h3>
            </button>
            {expandedSections['raw-json'] && (
              <pre className="p-4 rounded-lg bg-black/20 overflow-x-auto text-xs font-mono theme-text-primary max-h-[600px] overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sales Geography Section ──────────────────────────────────────────────────

function SalesGeographySection({
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

    const params = new URLSearchParams({ connectionId, test: 'sales-geography' })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const t0 = Date.now()
    try {
      const res = await fetch(`/api/providers/dynamics/income-statement-test?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setData(json)
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, startDate, endDate])

  // ── ECharts: Sales by Country (horizontal bar) ──
  const countryChartOption = useMemo(() => {
    if (!data?.byCountry?.length) return null
    const sorted = [...data.byCountry].sort((a: any, b: any) => a.totalAmount - b.totalAmount)
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          const d = params[0]
          const item = sorted[d.dataIndex]
          const inferred = item.inferredCount
            ? `<br/><span style="color:#f59e0b">Inferred: ${item.inferredCount}</span>`
            : ''
          return `<b>${item.country}</b><br/>Sales: $${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>Invoices: ${item.invoiceCount}<br/>Customers: ${item.customerCount}${inferred}`
        },
      },
      grid: { left: '3%', right: '8%', top: 10, bottom: 10, containLabel: true },
      xAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) =>
            v >= 1000000
              ? `$${(v / 1000000).toFixed(1)}M`
              : v >= 1000
                ? `$${(v / 1000).toFixed(0)}K`
                : `$${v}`,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category' as const,
        data: sorted.map((c: any) => c.country),
        axisLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar' as const,
          data: sorted.map((c: any) => c.totalAmount),
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: 'rgba(245,158,11,0.6)' },
                { offset: 1, color: 'rgba(245,158,11,0.9)' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 30,
          label: {
            show: true,
            position: 'right' as const,
            formatter: (p: any) => {
              const v = p.value
              return v >= 1000000
                ? `$${(v / 1000000).toFixed(1)}M`
                : v >= 1000
                  ? `$${(v / 1000).toFixed(0)}K`
                  : `$${v}`
            },
            color: 'rgba(255,255,255,0.7)',
            fontSize: 11,
          },
        },
      ],
    }
  }, [data?.byCountry])

  // ── ECharts: Sales by City (treemap) ──
  const cityTreemapOption = useMemo(() => {
    if (!data?.byCity?.length) return null
    // Group cities by country for treemap hierarchy
    const countryMap: Record<
      string,
      { name: string; children: { name: string; value: number; invoiceCount: number }[] }
    > = {}
    for (const c of data.byCity) {
      const country = c.country || '(unknown)'
      if (!countryMap[country]) countryMap[country] = { name: country, children: [] }
      countryMap[country].children.push({
        name: `${c.city}${c.state ? `, ${c.state}` : ''}`,
        value: c.totalAmount,
        invoiceCount: c.invoiceCount,
      })
    }
    return {
      tooltip: {
        formatter: (p: any) => {
          if (p.data.children)
            return `<b>${p.name}</b><br/>Total: $${p.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}`
          return `<b>${p.name}</b><br/>Sales: $${p.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>Invoices: ${p.data.invoiceCount || 0}`
        },
      },
      series: [
        {
          type: 'treemap' as const,
          data: Object.values(countryMap).map((country) => ({
            name: country.name,
            children: country.children,
          })),
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: '{b}',
            fontSize: 11,
            color: '#fff',
          },
          upperLabel: {
            show: true,
            height: 22,
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold' as const,
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: [4, 4, 0, 0],
            padding: [3, 6],
          },
          itemStyle: {
            borderColor: 'rgba(0,0,0,0.3)',
            borderWidth: 1,
            gapWidth: 2,
          },
          levels: [
            {
              itemStyle: { borderColor: 'rgba(0,0,0,0.5)', borderWidth: 2, gapWidth: 3 },
              upperLabel: { show: true },
              color: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'],
            },
            {
              colorSaturation: [0.35, 0.7],
              itemStyle: { borderColorSaturation: 0.6, gapWidth: 1 },
            },
          ],
        },
      ],
    }
  }, [data?.byCity])

  // ── ECharts: Sales by Dimension (Brand) bar chart ──
  const dimensionChartOption = useMemo(() => {
    if (!data?.byDimension1?.length) return null
    const sorted = [...data.byDimension1].sort((a: any, b: any) => b.totalAmount - a.totalAmount)
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          const d = params[0]
          const item = sorted[d.dataIndex]
          return `<b>${item.code}</b><br/>Sales: $${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>Invoices: ${item.invoiceCount}`
        },
      },
      grid: { left: '3%', right: '4%', top: 30, bottom: 30, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: sorted.map((d: any) => d.code),
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, rotate: 30 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) =>
            v >= 1000000
              ? `$${(v / 1000000).toFixed(1)}M`
              : v >= 1000
                ? `$${(v / 1000).toFixed(0)}K`
                : `$${v}`,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          type: 'bar' as const,
          data: sorted.map((d: any) => d.totalAmount),
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16,185,129,0.9)' },
                { offset: 1, color: 'rgba(16,185,129,0.4)' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 40,
        },
      ],
    }
  }, [data?.byDimension1])

  const chartHeight = useMemo(() => {
    if (!data?.byCountry?.length) return 300
    return Math.max(200, data.byCountry.length * 40 + 40)
  }, [data?.byCountry])

  return (
    <div className="space-y-6">
      {/* Run button */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={fetchData}
          disabled={!connectionId || loading}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Fetching Sales Geography...'
            : data
              ? 'Refresh Geography'
              : 'Run Sales Geography'}
        </button>
        {durationMs != null && <span className="text-xs theme-text-secondary">{durationMs}ms</span>}
        {data?.durationMs != null && (
          <span className="text-xs theme-text-secondary">({data.durationMs}ms server)</span>
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
            <p className="text-sm theme-text-secondary">
              Fetching sales invoices with geographic data...
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
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Invoices', value: data.totalInvoices?.toLocaleString() },
              { label: 'Total Sales', value: fmt(data.totalAmount) },
              { label: 'Countries', value: data.byCountry?.length || 0 },
              { label: 'Cities', value: data.byCity?.length || 0 },
              {
                label: 'Geo Resolved',
                value: data.countryResolution
                  ? `${data.countryResolution.resolvedByInference}/${data.countryResolution.totalWithoutCountry}`
                  : '-',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="glass-luxury-card rounded-xl p-4 border border-gray-200/10"
              >
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary font-medium mb-1">
                  {card.label}
                </p>
                <p className="text-lg font-semibold theme-text-primary">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Country Resolution Info */}
          {data.countryResolution && (
            <div className="glass-luxury-card p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-semibold theme-text-primary">Country Resolution</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {data.countryResolution.resolvedByInference} of{' '}
                  {data.countryResolution.totalWithoutCountry} unknowns resolved
                </span>
                {data.countryResolution.stillUnknown > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    {data.countryResolution.stillUnknown} still unknown
                  </span>
                )}
              </div>
              {data.countryResolution.inferenceLog?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('inference-log')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['inference-log'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Inference Log ({data.countryResolution.inferenceLog.length} rules applied)
                  </button>
                  {expandedSections['inference-log'] && (
                    <div className="space-y-1">
                      {data.countryResolution.inferenceLog.map((log: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 text-xs p-2 rounded bg-white/5"
                        >
                          <span className="theme-text-primary truncate max-w-[250px]">
                            {log.customer}
                          </span>
                          <span className="theme-text-secondary">→</span>
                          <span className="text-emerald-400 font-mono font-semibold">
                            {log.inferredCountry}
                          </span>
                          <span className="theme-text-secondary text-[11px]">({log.rule})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* World Sales Map */}
          {data.byCountry?.length > 0 && (
            <div className="glass-luxury-card p-5 space-y-3">
              <h3 className="text-base font-semibold theme-text-primary">
                Sales Heatmap
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  Scroll to zoom, drag to pan
                </span>
              </h3>
              <EChartsWorldMap data={data.byCountry} height={520} formatCurrency={fmt} />
            </div>
          )}

          {/* Sales by Country chart */}
          {countryChartOption && (
            <div className="glass-luxury-card p-5 space-y-3">
              <h3 className="text-base font-semibold theme-text-primary">
                Sales by Country
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  {data.byCountry.length} countries
                  {data.countryResolution?.resolvedByInference > 0 && (
                    <span className="text-amber-400 ml-1">(includes inferred)</span>
                  )}
                </span>
              </h3>
              <div style={{ height: chartHeight }}>
                <ReactECharts
                  option={countryChartOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>

              {/* Country detail table */}
              <button
                onClick={() => toggleSection('country-table')}
                className="flex items-center gap-2 text-xs font-medium theme-text-secondary"
              >
                {expandedSections['country-table'] ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Country Details Table ({data.byCountry.length})
              </button>
              {expandedSections['country-table'] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1 px-2 theme-text-secondary">Country</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Invoices</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Inferred</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Customers</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Total</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Cities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCountry.map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-1 px-2 font-mono font-semibold theme-text-primary">
                            {c.country}
                          </td>
                          <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                            {c.invoiceCount}
                          </td>
                          <td className="py-1 px-2 text-right font-mono">
                            {c.inferredCount > 0 ? (
                              <span className="text-amber-400">{c.inferredCount}</span>
                            ) : (
                              <span className="theme-text-secondary">-</span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                            {c.customerCount}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-amber-400">
                            {fmt(c.totalAmount)}
                          </td>
                          <td className="py-1 px-2 theme-text-secondary text-[11px] truncate max-w-[300px]">
                            {c.cities?.slice(0, 5).join(', ')}
                            {c.cities?.length > 5 && ` +${c.cities.length - 5} more`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sales by City treemap */}
          {cityTreemapOption && (
            <div className="glass-luxury-card p-5 space-y-3">
              <h3 className="text-base font-semibold theme-text-primary">
                Sales by City
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  {data.byCity.length} cities across {data.byCountry?.length || 0} countries
                </span>
              </h3>
              <div style={{ height: 400 }}>
                <ReactECharts
                  option={cityTreemapOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>

              {/* City detail table */}
              <button
                onClick={() => toggleSection('city-table')}
                className="flex items-center gap-2 text-xs font-medium theme-text-secondary"
              >
                {expandedSections['city-table'] ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                City Details Table ({data.byCity.length})
              </button>
              {expandedSections['city-table'] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Country</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">State</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Invoices</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Customers</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Total</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">
                          Sample Customers
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCity.map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-1 px-2 theme-text-primary">{c.city}</td>
                          <td className="py-1 px-2 theme-text-secondary">{c.country}</td>
                          <td className="py-1 px-2 theme-text-secondary">{c.state || '-'}</td>
                          <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                            {c.invoiceCount}
                          </td>
                          <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                            {c.customerCount}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-amber-400">
                            {fmt(c.totalAmount)}
                          </td>
                          <td className="py-1 px-2 theme-text-secondary text-[11px] truncate max-w-[250px]">
                            {c.customers?.join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sales by Dimension (Brand) */}
          {dimensionChartOption && (
            <div className="glass-luxury-card p-5 space-y-3">
              <h3 className="text-base font-semibold theme-text-primary">
                Sales by Brand (Dimension 1)
                <span className="text-xs font-normal theme-text-secondary ml-2">
                  {data.byDimension1.length} brands
                </span>
              </h3>
              <div style={{ height: 300 }}>
                <ReactECharts
                  option={dimensionChartOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            </div>
          )}

          {/* Dimension 2 if available */}
          {data.byDimension2?.length > 0 && (
            <div className="glass-luxury-card p-5 space-y-3">
              <button
                onClick={() => toggleSection('dim2')}
                className="flex items-center gap-2 w-full text-left"
              >
                {expandedSections['dim2'] ? (
                  <ChevronDown className="w-4 h-4 theme-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 theme-text-secondary" />
                )}
                <h3 className="text-base font-semibold theme-text-primary">
                  Sales by Dimension 2
                  <span className="text-xs font-normal theme-text-secondary ml-2">
                    {data.byDimension2.length} values
                  </span>
                </h3>
              </button>
              {expandedSections['dim2'] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1 px-2 theme-text-secondary">Code</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Invoices</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byDimension2.map((d: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-1 px-2 theme-text-primary font-mono">{d.code}</td>
                          <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                            {d.invoiceCount}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-emerald-400">
                            {fmt(d.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sales by Customer table */}
          {data.byCustomer?.length > 0 && (
            <div className="glass-luxury-card p-5 space-y-3">
              <button
                onClick={() => toggleSection('geo-customers')}
                className="flex items-center gap-2 w-full text-left"
              >
                {expandedSections['geo-customers'] ? (
                  <ChevronDown className="w-4 h-4 theme-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 theme-text-secondary" />
                )}
                <h3 className="text-base font-semibold theme-text-primary">
                  Top Customers by Sales
                  <span className="text-xs font-normal theme-text-secondary ml-2">
                    {data.byCustomer.length} customers
                  </span>
                </h3>
              </button>
              {expandedSections['geo-customers'] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1 px-2 theme-text-secondary">Code</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Customer</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">City</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Country</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">State</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Source</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Invoices</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCustomer.map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-1 px-2 font-mono theme-text-secondary">
                            {c.customerNumber}
                          </td>
                          <td className="py-1 px-2 theme-text-primary truncate max-w-[200px]">
                            {c.name}
                          </td>
                          <td className="py-1 px-2 theme-text-secondary">{c.city || '-'}</td>
                          <td className="py-1 px-2 theme-text-secondary">{c.country || '-'}</td>
                          <td className="py-1 px-2 theme-text-secondary">{c.state || '-'}</td>
                          <td className="py-1 px-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                c.countrySource === 'most-frequent'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : c.countrySource?.startsWith('inferred')
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : c.countrySource === 'unknown'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {c.countrySource === 'most-frequent'
                                ? 'freq'
                                : c.countrySource?.startsWith('inferred')
                                  ? 'inferred'
                                  : c.countrySource === 'unknown'
                                    ? 'unknown'
                                    : 'invoice'}
                            </span>
                          </td>
                          <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                            {c.invoiceCount}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-amber-400">
                            {fmt(c.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON */}
          <div className="glass-luxury-card p-5 space-y-3">
            <button
              onClick={() => toggleSection('geo-raw-json')}
              className="flex items-center gap-2 w-full text-left"
            >
              {expandedSections['geo-raw-json'] ? (
                <ChevronDown className="w-4 h-4 theme-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 theme-text-secondary" />
              )}
              <h3 className="text-base font-semibold theme-text-primary">Raw JSON Response</h3>
            </button>
            {expandedSections['geo-raw-json'] && (
              <pre className="p-4 rounded-lg bg-black/20 overflow-x-auto text-xs font-mono theme-text-primary max-h-[600px] overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Full Diagnostic Section ───────────────────────────────────────────────────

function FullDiagnosticSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const runTests = useCallback(
    async (testIds?: string[]) => {
      if (!connectionId) return
      const ids = testIds || DIAGNOSTIC_TESTS.map((t) => t.id)

      setLoading((prev) => {
        const next = { ...prev }
        ids.forEach((id) => (next[id] = true))
        return next
      })

      const standardIds = ids.filter((id) => {
        const test = DIAGNOSTIC_TESTS.find((t) => t.id === id)
        return !(test as any)?.customRoute
      })
      const customTests = ids
        .map((id) => DIAGNOSTIC_TESTS.find((t) => t.id === id))
        .filter(
          (t): t is (typeof DIAGNOSTIC_TESTS)[number] & { customRoute: string } =>
            !!(t as any)?.customRoute
        )

      const baseParams = new URLSearchParams({ connectionId })
      if (startDate) baseParams.set('startDate', startDate)
      if (endDate) baseParams.set('endDate', endDate)

      const standardPromise =
        standardIds.length > 0
          ? (async () => {
              const params = new URLSearchParams(baseParams)
              params.set('tests', standardIds.join(','))
              try {
                const res = await fetch(`/api/providers/dynamics/diagnostic?${params}`)
                const json = await res.json()
                if (json.tests) {
                  const newResults: Record<string, any> = {}
                  for (const test of json.tests) {
                    newResults[test.id] = test
                  }
                  setResults((prev) => ({ ...prev, ...newResults }))
                }
              } catch (err) {
                standardIds.forEach((id) => {
                  setResults((prev) => ({
                    ...prev,
                    [id]: {
                      id,
                      label: id,
                      success: false,
                      error: err instanceof Error ? err.message : 'Network error',
                      durationMs: 0,
                    },
                  }))
                })
              } finally {
                setLoading((prev) => {
                  const next = { ...prev }
                  standardIds.forEach((id) => (next[id] = false))
                  return next
                })
              }
            })()
          : Promise.resolve()

      const customPromises = customTests.map(async (test) => {
        const t0 = Date.now()
        try {
          const res = await fetch(`${(test as any).customRoute}?${baseParams}`)
          const json = await res.json()
          setResults((prev) => ({
            ...prev,
            [test.id]: {
              id: test.id,
              label: test.label,
              detail: json.error
                ? `Error: ${json.error}`
                : `Success — ${json.durationMs ?? 0}ms server-side`,
              success: !json.error,
              data: json.data || json,
              durationMs: Date.now() - t0,
            },
          }))
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [test.id]: {
              id: test.id,
              label: test.label,
              success: false,
              error: err instanceof Error ? err.message : 'Network error',
              durationMs: Date.now() - t0,
            },
          }))
        } finally {
          setLoading((prev) => ({ ...prev, [test.id]: false }))
        }
      })

      await Promise.all([standardPromise, ...customPromises])
    },
    [connectionId, startDate, endDate]
  )

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const anyLoading = Object.values(loading).some(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => runTests()}
          disabled={!connectionId || anyLoading}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {anyLoading ? 'Running...' : 'Run All Tests'}
        </button>
        <span className="text-xs theme-text-secondary">
          {Object.values(results).filter((r: any) => r?.success).length} passed,{' '}
          {Object.values(results).filter((r: any) => r && !r.success).length} failed
        </span>
      </div>

      <div className="grid gap-3">
        {DIAGNOSTIC_TESTS.map((test) => {
          const result = results[test.id]
          const isLoading = loading[test.id]
          const isExpanded = expanded[test.id]

          return (
            <div
              key={test.id}
              className={`glass-luxury-card border rounded-xl overflow-hidden transition-colors ${
                result?.success === true
                  ? 'border-emerald-500/20'
                  : result?.success === false
                    ? 'border-red-500/20'
                    : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isLoading
                        ? 'bg-blue-500 animate-pulse'
                        : result?.success === true
                          ? 'bg-emerald-500'
                          : result?.success === false
                            ? 'bg-red-500'
                            : 'bg-white/20'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium theme-text-primary text-sm">{test.label}</span>
                      {result?.durationMs != null && (
                        <span className="text-xs theme-text-secondary">{result.durationMs}ms</span>
                      )}
                      {result?.rowCount != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 theme-text-secondary">
                          {result.rowCount} rows
                        </span>
                      )}
                    </div>
                    <p className="text-xs theme-text-secondary truncate">{test.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {result?.detail && (
                    <span className="text-xs theme-text-secondary max-w-[300px] truncate hidden lg:block">
                      {result.detail}
                    </span>
                  )}
                  <button
                    onClick={() => runTests([test.id])}
                    disabled={!connectionId || isLoading}
                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Run'}
                  </button>
                  {result?.data && (
                    <button
                      onClick={() => toggleExpand(test.id)}
                      className="px-2 py-1.5 text-xs rounded-lg border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  )}
                </div>
              </div>

              {result?.detail && (
                <div className="px-4 pb-2 lg:hidden">
                  <p className="text-xs theme-text-secondary">{result.detail}</p>
                </div>
              )}

              {result?.success === false && result.error && (
                <div className="mx-4 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{result.error}</p>
                </div>
              )}

              {isExpanded && result?.data && (
                <div className="border-t border-white/10 p-4">
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
