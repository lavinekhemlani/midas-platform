'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { apiClient } from '@/lib/apiClient'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(v)

const fmtDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ShopifyStore {
  domain: string
  name: string
  connected: boolean
}

interface EndpointDef {
  id: string
  label: string
  description: string
  path: string
  method: 'GET'
  dateMode: 'range' | 'period' | 'none'
  defaultParams?: Record<string, string>
}

interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error'
  data?: any
  error?: string
  durationMs?: number
  httpStatus?: number
}

// ── Date Presets ─────────────────────────────────────────────────────────────

const DATE_PRESETS: Record<
  string,
  { label: string; getRange: () => { start: string; end: string } }
> = {
  last7d: {
    label: '7 Days',
    getRange: () => {
      const e = new Date()
      const s = new Date()
      s.setDate(s.getDate() - 7)
      return { start: fmtDate(s), end: fmtDate(e) }
    },
  },
  last30d: {
    label: '30 Days',
    getRange: () => {
      const e = new Date()
      const s = new Date()
      s.setDate(s.getDate() - 30)
      return { start: fmtDate(s), end: fmtDate(e) }
    },
  },
  last90d: {
    label: '90 Days',
    getRange: () => {
      const e = new Date()
      const s = new Date()
      s.setDate(s.getDate() - 90)
      return { start: fmtDate(s), end: fmtDate(e) }
    },
  },
  thisMonth: {
    label: 'This Month',
    getRange: () => {
      const n = new Date()
      return { start: fmtDate(new Date(n.getFullYear(), n.getMonth(), 1)), end: fmtDate(n) }
    },
  },
  lastMonth: {
    label: 'Last Month',
    getRange: () => {
      const n = new Date()
      return {
        start: fmtDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        end: fmtDate(new Date(n.getFullYear(), n.getMonth(), 0)),
      }
    },
  },
  thisYear: {
    label: 'This Year',
    getRange: () => {
      const n = new Date()
      return { start: fmtDate(new Date(n.getFullYear(), 0, 1)), end: fmtDate(n) }
    },
  },
  allTime: { label: 'All Time', getRange: () => ({ start: '', end: '' }) },
}

// ── Endpoint Definitions ─────────────────────────────────────────────────────

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'shop',
    label: 'Shop Info',
    description: 'Basic shop details, timezone, currency, plan',
    path: '/api/providers/shopify/currency',
    method: 'GET',
    dateMode: 'none',
  },
  {
    id: 'summary',
    label: 'Summary (Financial)',
    description:
      'Orders, revenue, products, customers, Shopify Payments — with date filtering. Calls are batched (2/s) with auto-retry to avoid Shopify 429 rate limits.',
    path: '/api/providers/shopify/summary',
    method: 'GET',
    dateMode: 'range',
  },
  {
    id: 'orders',
    label: 'Orders',
    description: 'Order list with fulfillment pipeline and risk data — with date filtering',
    path: '/api/providers/shopify/orders',
    method: 'GET',
    dateMode: 'range',
    defaultParams: { limit: '50', status: 'any' },
  },
  {
    id: 'orders-processed',
    label: 'Orders (processed_at)',
    description: 'Same as Orders but filters by processed_at — better for financial date accuracy',
    path: '/api/providers/shopify/orders',
    method: 'GET',
    dateMode: 'range',
    defaultParams: { limit: '50', status: 'any', date_field: 'processed_at' },
  },
  {
    id: 'products',
    label: 'Products',
    description: 'All products with status breakdown, types, vendors',
    path: '/api/providers/shopify/products',
    method: 'GET',
    dateMode: 'none',
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Customer list with GraphQL enrichment (LTV, marketing consent)',
    path: '/api/providers/shopify/customers',
    method: 'GET',
    dateMode: 'none',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Locations, inventory levels, GraphQL cost data',
    path: '/api/providers/shopify/inventory',
    method: 'GET',
    dateMode: 'none',
  },
  {
    id: 'analytics',
    label: 'Analytics (ShopifyQL)',
    description: 'Sales trends, top products, channels, geo, discounts, referrers',
    path: '/api/providers/shopify/analytics',
    method: 'GET',
    dateMode: 'period',
  },
  {
    id: 'marketing',
    label: 'Marketing (Attribution)',
    description: 'Sessions & sales by channel+type, session trends, previous period comparison, conversion rates',
    path: '/api/providers/shopify/marketing',
    method: 'GET',
    dateMode: 'range',
  },
  {
    id: 'marketing-activities',
    label: 'Marketing Activities (Ad Spend)',
    description: 'Marketing campaigns, ad spend, budget, UTM params — from GraphQL marketingActivities + REST marketing_events',
    path: '/api/providers/shopify/marketing-activities',
    method: 'GET',
    dateMode: 'none',
  },
  {
    id: 'customer-journeys',
    label: 'Customer Journeys',
    description: 'Order touchpoints — first/last visit source, UTM params, days to conversion, moments count (requires read_customer_events)',
    path: '/api/providers/shopify/customer-journeys?includeOrders=true',
    method: 'GET',
    dateMode: 'range',
  },
]

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ShopifyDevPage() {
  const { organization } = useSession()

  // ── Store selector state
  const stores = useMemo((): ShopifyStore[] => {
    const shopifyInfo = organization?.providers?.shopify as any
    if (!shopifyInfo?.connections) return []
    return Object.entries(shopifyInfo.connections).map(([domain, conn]: [string, any]) => ({
      domain,
      name: conn?.credentials?.company_name || domain.replace('.myshopify.com', ''),
      connected: !!conn?.credentials?.connected,
    }))
  }, [organization])

  const [selectedDomain, setSelectedDomain] = useState('')
  useEffect(() => {
    if (!selectedDomain && stores.length > 0) {
      setSelectedDomain(stores[0].domain)
    }
  }, [stores, selectedDomain])

  // ── Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return fmtDate(d)
  })
  const [endDate, setEndDate] = useState(() => fmtDate(new Date()))
  const [analyticsPeriod, setAnalyticsPeriod] = useState('30d')

  const applyPreset = (key: string) => {
    const { start, end } = DATE_PRESETS[key].getRange()
    setStartDate(start)
    setEndDate(end)
  }

  // ── Test results state
  const [results, setResults] = useState<Record<string, TestResult>>({})

  const updateResult = useCallback((id: string, result: Partial<TestResult>) => {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...result } as TestResult }))
  }, [])

  // ── Run single endpoint
  const runEndpoint = useCallback(
    async (endpoint: EndpointDef) => {
      if (!selectedDomain) return
      updateResult(endpoint.id, { status: 'loading', data: undefined, error: undefined })

      const start = Date.now()
      try {
        const params = new URLSearchParams({ shop: selectedDomain })

        // Add date params based on mode
        if (endpoint.dateMode === 'range') {
          if (startDate) params.set('startDate', startDate)
          if (endDate) params.set('endDate', endDate)
        } else if (endpoint.dateMode === 'period') {
          params.set('period', analyticsPeriod)
          // Also pass custom dates if period is custom
          if (analyticsPeriod === 'custom' && startDate && endDate) {
            params.set('startDate', startDate)
            params.set('endDate', endDate)
          }
        }

        // Add default params
        if (endpoint.defaultParams) {
          for (const [k, v] of Object.entries(endpoint.defaultParams)) {
            if (!params.has(k)) params.set(k, v)
          }
        }

        const url = `${endpoint.path}?${params.toString()}`
        const res = await apiClient(url)
        const durationMs = Date.now() - start
        const json = await res.json()

        if (!res.ok) {
          updateResult(endpoint.id, {
            status: 'error',
            error: json.error || json.message || `HTTP ${res.status}`,
            data: json,
            durationMs,
            httpStatus: res.status,
          })
        } else {
          updateResult(endpoint.id, {
            status: 'success',
            data: json,
            durationMs,
            httpStatus: res.status,
          })
        }
      } catch (err) {
        updateResult(endpoint.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error',
          durationMs: Date.now() - start,
        })
      }
    },
    [selectedDomain, startDate, endDate, analyticsPeriod, updateResult]
  )

  // ── Run all endpoints
  const runAll = useCallback(async () => {
    for (const ep of ENDPOINTS) {
      updateResult(ep.id, { status: 'loading' })
    }
    await Promise.allSettled(ENDPOINTS.map((ep) => runEndpoint(ep)))
  }, [runEndpoint, updateResult])

  // ── Expanded JSON state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  // ── Reconciliation helper: extract key metrics from results
  const reconciliation = useMemo(() => {
    const summary = results.summary?.data?.data || results.summary?.data
    const orders = results.orders?.data?.data || results.orders?.data
    const analytics = results.analytics?.data?.data || results.analytics?.data

    if (!summary && !orders && !analytics) return null

    return {
      summary: summary
        ? {
            orderCount: summary.summary?.orders?.totalCount ?? summary.summary?.totalCount ?? '—',
            revenue: summary.financials?.revenue ?? summary.summary?.orders?.totalRevenue ?? '—',
            currency: summary.financials?.currency ?? summary.summary?.orders?.currency ?? '—',
          }
        : null,
      orders: orders
        ? {
            orderCount: orders.summary?.totalCount ?? orders.orders?.length ?? '—',
            revenue: orders.summary?.totalRevenue ?? '—',
            currency: orders.summary?.currency ?? '—',
          }
        : null,
      analytics: analytics
        ? {
            orderCount: analytics.summary?.orders ?? '—',
            revenue: analytics.summary?.totalSales ?? '—',
            netSales: analytics.summary?.netSales ?? '—',
            grossSales: analytics.summary?.grossSales ?? '—',
          }
        : null,
    }
  }, [results])

  const selectedStore = stores.find((s) => s.domain === selectedDomain)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light tracking-tight">
          Shopify API <span className="text-[#7AB55C]">Dev Console</span>
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Test endpoints, verify date ranges, inspect scope access, reconcile data
        </p>
      </div>

      {/* Store Selector */}
      <div className="mb-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-medium tracking-widest uppercase text-white/40">
            Connected Stores
          </span>
          <span className="text-xs text-white/20">
            {stores.length} store{stores.length !== 1 ? 's' : ''}
          </span>
        </div>
        {stores.length === 0 ? (
          <p className="text-sm text-amber-500/80">
            No Shopify stores connected. Connect one from the dashboard.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => (
              <button
                key={store.domain}
                onClick={() => setSelectedDomain(store.domain)}
                className={`px-4 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                  selectedDomain === store.domain
                    ? 'bg-[#7AB55C]/20 border-[#7AB55C]/50 text-[#7AB55C] border'
                    : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.06]'
                }`}
              >
                <span className="font-medium">{store.name}</span>
                <span className="text-xs ml-2 opacity-50">{store.domain}</span>
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ml-2 ${store.connected ? 'bg-emerald-500' : 'bg-red-500'}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Controls */}
      <div className="mb-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-medium tracking-widest uppercase text-white/40">
            Date Range
          </span>
          <span className="text-xs text-white/20 font-mono">
            {startDate || '(all)'} → {endDate || '(all)'}
          </span>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(DATE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-white/40">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white/80 focus:border-[#7AB55C]/50 outline-none"
          />
          <label className="text-xs text-white/40">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white/80 focus:border-[#7AB55C]/50 outline-none"
          />
        </div>

        {/* Analytics period selector */}
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs text-white/40">ShopifyQL Period</label>
          <div className="flex gap-1">
            {['7d', '30d', '90d', '6m', '12m', 'custom'].map((p) => (
              <button
                key={p}
                onClick={() => setAnalyticsPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
                  analyticsPeriod === p
                    ? 'bg-[#7AB55C]/20 text-[#7AB55C] border border-[#7AB55C]/30'
                    : 'bg-white/[0.04] text-white/50 border border-transparent hover:bg-white/[0.06]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {analyticsPeriod === 'custom' && (
            <span className="text-xs text-white/30">Uses date range above</span>
          )}
        </div>
      </div>

      {/* Run All Button */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={runAll}
          disabled={!selectedDomain}
          className="px-5 py-2.5 rounded-xl bg-[#7AB55C] text-white font-medium text-sm hover:bg-[#6aa04c] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          Run All Endpoints
        </button>
        <span className="text-xs text-white/30">
          {selectedStore ? `Targeting ${selectedStore.name}` : 'Select a store first'}
        </span>
      </div>

      {/* Reconciliation Panel */}
      {reconciliation && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium tracking-widest uppercase text-amber-500/80">
              Data Reconciliation
            </span>
            <span className="text-xs text-white/20">
              Compare totals across endpoints for the same date range
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {reconciliation.summary && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-2 font-medium">Summary Route</p>
                <p className="text-white/70">
                  Orders:{' '}
                  <span className="text-white font-mono">{reconciliation.summary.orderCount}</span>
                </p>
                <p className="text-white/70">
                  Revenue:{' '}
                  <span className="text-white font-mono">
                    {typeof reconciliation.summary.revenue === 'number'
                      ? fmt(reconciliation.summary.revenue)
                      : reconciliation.summary.revenue}
                  </span>
                </p>
                <p className="text-white/70">
                  Currency:{' '}
                  <span className="text-white font-mono">{reconciliation.summary.currency}</span>
                </p>
              </div>
            )}
            {reconciliation.orders && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-2 font-medium">Orders Route</p>
                <p className="text-white/70">
                  Orders:{' '}
                  <span className="text-white font-mono">{reconciliation.orders.orderCount}</span>
                </p>
                <p className="text-white/70">
                  Revenue:{' '}
                  <span className="text-white font-mono">
                    {typeof reconciliation.orders.revenue === 'number'
                      ? fmt(reconciliation.orders.revenue)
                      : reconciliation.orders.revenue}
                  </span>
                </p>
                <p className="text-white/70">
                  Currency:{' '}
                  <span className="text-white font-mono">{reconciliation.orders.currency}</span>
                </p>
              </div>
            )}
            {reconciliation.analytics && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-2 font-medium">Analytics (ShopifyQL)</p>
                <p className="text-white/70">
                  Orders:{' '}
                  <span className="text-white font-mono">
                    {reconciliation.analytics.orderCount}
                  </span>
                </p>
                <p className="text-white/70">
                  Total Sales:{' '}
                  <span className="text-white font-mono">
                    {typeof reconciliation.analytics.revenue === 'number'
                      ? fmt(reconciliation.analytics.revenue)
                      : reconciliation.analytics.revenue}
                  </span>
                </p>
                <p className="text-white/70">
                  Net Sales:{' '}
                  <span className="text-white font-mono">
                    {typeof reconciliation.analytics.netSales === 'number'
                      ? fmt(reconciliation.analytics.netSales)
                      : reconciliation.analytics.netSales}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Endpoint Cards */}
      <div className="space-y-4">
        {ENDPOINTS.map((endpoint) => {
          const result = results[endpoint.id] || { status: 'idle' }
          const isExpanded = expanded[endpoint.id]

          return (
            <div
              key={endpoint.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Status dot */}
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

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{endpoint.label}</h3>
                      {/* Date mode badge */}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          endpoint.dateMode === 'range'
                            ? 'bg-blue-500/15 text-blue-400'
                            : endpoint.dateMode === 'period'
                              ? 'bg-purple-500/15 text-purple-400'
                              : 'bg-white/[0.06] text-white/30'
                        }`}
                      >
                        {endpoint.dateMode === 'range'
                          ? 'DATE RANGE'
                          : endpoint.dateMode === 'period'
                            ? 'SHOPIFYQL'
                            : 'NO DATES'}
                      </span>
                      {result.httpStatus && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            result.httpStatus < 300
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {result.httpStatus}
                        </span>
                      )}
                      {result.durationMs !== undefined && (
                        <span className="text-[10px] text-white/30 font-mono">
                          {result.durationMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{endpoint.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runEndpoint(endpoint)}
                    disabled={!selectedDomain || result.status === 'loading'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7AB55C]/15 text-[#7AB55C] border border-[#7AB55C]/20 hover:bg-[#7AB55C]/25 disabled:opacity-30 transition-all cursor-pointer"
                  >
                    {result.status === 'loading' ? 'Running...' : 'Run'}
                  </button>
                  {result.data && (
                    <button
                      onClick={() => toggleExpand(endpoint.id)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.06] transition-all cursor-pointer"
                    >
                      {isExpanded ? 'Collapse' : 'Expand JSON'}
                    </button>
                  )}
                  {result.data && (
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
                      }
                      className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.06] transition-all cursor-pointer"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {result.status === 'error' && result.error && (
                <div className="mx-4 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400 font-mono">{result.error}</p>
                </div>
              )}

              {/* Quick Stats (for known endpoints) */}
              {result.status === 'success' && !isExpanded && (
                <QuickStats endpointId={endpoint.id} data={result.data} />
              )}

              {/* Expanded JSON */}
              {isExpanded && result.data && (
                <div className="border-t border-white/[0.06]">
                  <pre className="p-4 text-xs text-white/70 overflow-auto max-h-[600px] font-mono leading-relaxed">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scope Tester */}
      <div className="mt-8 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-medium tracking-widest uppercase text-white/40">
            Scope Access Summary
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            {
              scope: 'read_orders',
              tested: !!results.orders?.data,
              ok: results.orders?.status === 'success',
            },
            {
              scope: 'read_all_orders',
              tested: !!results.orders?.data,
              ok:
                results.orders?.status === 'success' &&
                (results.orders?.data?.data?.summary?.totalCount || 0) > 0,
            },
            {
              scope: 'read_products',
              tested: !!results.products?.data,
              ok: results.products?.status === 'success',
            },
            {
              scope: 'read_inventory',
              tested: !!results.inventory?.data,
              ok: results.inventory?.status === 'success',
            },
            {
              scope: 'read_customers',
              tested: !!results.customers?.data,
              ok:
                results.customers?.status === 'success' && !results.customers?.data?.data?.warning,
            },
            {
              scope: 'read_reports / read_analytics',
              tested: !!results.analytics?.data,
              ok: results.analytics?.status === 'success',
            },
            {
              scope: 'read_marketing_events',
              tested: !!results['marketing-activities']?.data,
              ok: results['marketing-activities']?.status === 'success',
            },
            {
              scope: 'read_customer_events',
              tested: !!results['customer-journeys']?.data,
              ok: results['customer-journeys']?.status === 'success',
            },
          ].map(({ scope, tested, ok }) => (
            <div key={scope} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
              <span
                className={`w-2 h-2 rounded-full ${!tested ? 'bg-white/20' : ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <span className="text-xs font-mono text-white/60">{scope}</span>
              <span className="text-xs text-white/30 ml-auto">
                {!tested ? 'not tested' : ok ? 'accessible' : 'restricted / no data'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Quick Stats Display ──────────────────────────────────────────────────────

function QuickStats({ endpointId, data }: { endpointId: string; data: any }) {
  const d = data?.data || data

  if (endpointId === 'shop') {
    return (
      <div className="mx-4 mb-4 flex gap-4 text-xs">
        <Stat label="Shop" value={d?.shop?.name || d?.currency || '—'} />
        <Stat label="Currency" value={d?.currency || d?.shop?.currency || '—'} />
        <Stat label="Timezone" value={d?.shop?.iana_timezone || d?.timezone || '—'} />
        <Stat label="Plan" value={d?.shop?.plan_display_name || d?.plan || '—'} />
      </div>
    )
  }

  if (endpointId === 'summary') {
    const fin = d?.financials
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Orders" value={summary?.orders?.totalCount ?? summary?.totalCount ?? '—'} />
        <Stat
          label="Revenue"
          value={
            fin?.revenue != null
              ? fmt(fin.revenue)
              : summary?.orders?.totalRevenue != null
                ? fmt(summary.orders.totalRevenue)
                : '—'
          }
        />
        <Stat label="Net Revenue" value={fin?.netRevenue != null ? fmt(fin.netRevenue) : '—'} />
        <Stat label="Gross Profit" value={fin?.grossProfit != null ? fmt(fin.grossProfit) : '—'} />
        <Stat label="Refunds" value={fin?.totalRefunded != null ? fmt(fin.totalRefunded) : '—'} />
        <Stat label="AOV" value={fin?.avgOrderValue != null ? fmt(fin.avgOrderValue) : '—'} />
        <Stat label="Products" value={summary?.products?.totalCount ?? '—'} />
        <Stat label="Customers" value={summary?.customers?.totalCount ?? '—'} />
      </div>
    )
  }

  if (endpointId === 'orders') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Total Orders" value={summary?.totalCount ?? '—'} />
        <Stat
          label="Revenue"
          value={summary?.totalRevenue != null ? fmt(summary.totalRevenue) : '—'}
        />
        <Stat
          label="AOV"
          value={summary?.avgOrderValue != null ? fmt(summary.avgOrderValue) : '—'}
        />
        <Stat label="Fulfilled" value={summary?.fulfilledCount ?? '—'} />
        <Stat label="Unfulfilled" value={summary?.unfulfilled ?? '—'} />
        <Stat label="Refunded" value={summary?.refundedCount ?? '—'} />
        <Stat label="Cancelled" value={summary?.cancelledCount ?? '—'} />
        <Stat label="Risk (High)" value={summary?.riskHigh ?? '—'} />
        {d?.graphqlWarning && <span className="text-amber-500/70 text-xs">{d.graphqlWarning}</span>}
      </div>
    )
  }

  if (endpointId === 'products') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Total" value={summary?.totalCount ?? '—'} />
        <Stat label="Active" value={summary?.activeCount ?? '—'} />
        <Stat label="Draft" value={summary?.draftCount ?? '—'} />
        <Stat label="Archived" value={summary?.archivedCount ?? '—'} />
        <Stat label="Variants" value={summary?.totalVariants ?? '—'} />
        <Stat label="Types" value={summary?.productTypes?.length ?? '—'} />
      </div>
    )
  }

  if (endpointId === 'customers') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Total" value={summary?.totalCount ?? '—'} />
        <Stat label="With Orders" value={summary?.withOrdersCount ?? '—'} />
        <Stat label="Total Spent" value={summary?.totalSpent != null ? fmt(summary.totalSpent) : '—'} />
        <Stat label="Avg Spent" value={summary?.avgSpent != null ? fmt(summary.avgSpent) : '—'} />
        <Stat
          label="Returning Rate"
          value={summary?.returningRate != null ? `${summary.returningRate.toFixed(1)}%` : '—'}
        />
        <Stat
          label="Repeat Purchase"
          value={d?.repeatPurchaseRate != null ? `${d.repeatPurchaseRate}%` : '—'}
        />
        <Stat label="Email Subs" value={summary?.emailSubscribers ?? '—'} />
        <Stat label="Top Spenders" value={summary?.topSpenders ?? '—'} />
        <Stat label="At Risk" value={summary?.atRisk ?? '—'} />
        <Stat label="New (30d)" value={summary?.newLast30d ?? '—'} />
        <Stat
          label="Avg Days Between Orders"
          value={d?.avgDaysBetweenOrders != null ? `${d.avgDaysBetweenOrders}d` : '—'}
        />
        <Stat
          label="Avg Order Freq"
          value={d?.avgOrderFrequency != null ? `${d.avgOrderFrequency}x` : '—'}
        />
        <Stat label="VIP Customers" value={d?.vipCustomers?.length ?? '—'} />
        <Stat label="Top Products" value={d?.mostOrdered?.length ?? '—'} />
        <Stat label="Cohorts" value={d?.retentionCohorts?.length ?? '—'} />
        {d?.warning && <span className="text-amber-500/70 text-xs">{d.warning}</span>}
      </div>
    )
  }

  if (endpointId === 'inventory') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Locations" value={summary?.locationCount ?? '—'} />
        <Stat label="SKUs Tracked" value={summary?.trackedItems ?? '—'} />
        <Stat label="Total Units" value={summary?.totalAvailable ?? '—'} />
        <Stat label="Low Stock" value={summary?.lowStockCount ?? '—'} />
        <Stat label="Out of Stock" value={summary?.outOfStockCount ?? '—'} />
        <Stat
          label="Inventory Value"
          value={summary?.totalValue != null ? fmt(summary.totalValue) : '—'}
        />
      </div>
    )
  }

  if (endpointId === 'customer-journeys') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Orders" value={summary?.totalOrders ?? '—'} />
        <Stat label="With Journey" value={summary?.ordersWithJourney ?? '—'} />
        <Stat label="Avg Touchpoints" value={summary?.avgMomentsPerOrder ?? '—'} />
        <Stat label="Avg Days to Convert" value={summary?.avgDaysToConversion ?? '—'} />
        <Stat label="Sources" value={summary?.sourceBreakdown?.length ?? '—'} />
        <Stat label="New Customers" value={summary?.newCustomers ?? '—'} />
        <Stat label="New %" value={summary?.newPct != null ? `${summary.newPct}%` : '—'} />
        <Stat label="Returning" value={summary?.returningCustomers ?? '—'} />
        <Stat label="Returning %" value={summary?.returningPct != null ? `${summary.returningPct}%` : '—'} />
        <Stat label="Sessions / Purchase" value={summary?.avgMomentsPerOrder ?? '—'} />
        <Stat label="First Visit Sources" value={summary?.firstVisitSources?.length ?? '—'} />
        <Stat label="Last Visit Sources" value={summary?.lastVisitSources?.length ?? '—'} />
      </div>
    )
  }

  if (endpointId === 'marketing-activities') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Activities" value={summary?.totalActivities ?? '—'} />
        <Stat label="Events" value={summary?.totalEvents ?? '—'} />
        <Stat
          label="Total Ad Spend"
          value={summary?.totalAdSpend != null ? fmt(summary.totalAdSpend) : '—'}
        />
        <Stat label="Currency" value={summary?.currency ?? '—'} />
        <Stat label="Channels" value={summary?.byChannel?.length ?? '—'} />
        <Stat label="Tactics" value={summary?.byTactic?.length ?? '—'} />
      </div>
    )
  }

  if (endpointId === 'marketing') {
    const summary = d?.summary
    const channels = d?.channels
    const comparison = d?.comparison
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat label="Sessions" value={summary?.totalSessions ?? '—'} />
        <Stat
          label="Sales"
          value={summary?.totalSales != null ? fmt(summary.totalSales) : '—'}
        />
        <Stat label="Orders" value={summary?.totalOrders ?? '—'} />
        <Stat
          label="Conv. Rate"
          value={summary?.conversionRate != null ? `${summary.conversionRate.toFixed(2)}%` : '—'}
        />
        <Stat
          label="AOV"
          value={summary?.totalOrders > 0 ? fmt(summary.totalSales / summary.totalOrders) : '—'}
        />
        <Stat label="Channels" value={channels?.length ?? '—'} />
        <Stat label="Trend Points" value={d?.sessionsTrend?.length ?? '—'} />
        <Stat
          label="Sessions Δ"
          value={comparison?.sessionsChange != null ? `${comparison.sessionsChange}%` : '—'}
        />
        <Stat
          label="Sales Δ"
          value={comparison?.salesChange != null ? `${comparison.salesChange}%` : '—'}
        />
        <Stat label="Currency" value={summary?.currency ?? '—'} />
      </div>
    )
  }

  if (endpointId === 'analytics') {
    const summary = d?.summary
    return (
      <div className="mx-4 mb-4 flex flex-wrap gap-4 text-xs">
        <Stat
          label="Total Sales"
          value={summary?.totalSales != null ? fmt(summary.totalSales) : '—'}
        />
        <Stat
          label="Gross Sales"
          value={summary?.grossSales != null ? fmt(summary.grossSales) : '—'}
        />
        <Stat label="Net Sales" value={summary?.netSales != null ? fmt(summary.netSales) : '—'} />
        <Stat label="Orders" value={summary?.orders ?? '—'} />
        <Stat label="Discounts" value={summary?.discounts != null ? fmt(summary.discounts) : '—'} />
        <Stat label="Returns" value={summary?.returns != null ? fmt(summary.returns) : '—'} />
        <Stat label="Taxes" value={summary?.taxes != null ? fmt(summary.taxes) : '—'} />
        <Stat label="Shipping" value={summary?.shipping != null ? fmt(summary.shipping) : '—'} />
        <Stat label="Daily Points" value={d?.dailyTrend?.length ?? '—'} />
        <Stat label="Top Products" value={d?.topProducts?.length ?? '—'} />
      </div>
    )
  }

  return null
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-white/30">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  )
}
