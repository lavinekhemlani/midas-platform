'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'
import { cn } from '@/lib/utils'
import { ReactECharts } from '@/components/chat/visualizations/shared/ReactEChartsWrapper'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Date Helpers ──────────────────────────────────────────────────────────────

const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface DatePreset {
  label: string
  getRange: () => { start: string; end: string }
}

const DATE_PRESETS: Record<string, DatePreset> = {
  thisMonth: {
    label: 'This Month',
    getRange: () => {
      const now = new Date()
      return {
        start: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastMonth: {
    label: 'Last Month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: formatDateISO(start), end: formatDateISO(end) }
    },
  },
  thisQuarter: {
    label: 'This Quarter',
    getRange: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3)
      return {
        start: formatDateISO(new Date(now.getFullYear(), q * 3, 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastQuarter: {
    label: 'Last Quarter',
    getRange: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3) - 1
      const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const qAdj = q < 0 ? 3 : q
      return {
        start: formatDateISO(new Date(y, qAdj * 3, 1)),
        end: formatDateISO(new Date(y, (qAdj + 1) * 3, 0)),
      }
    },
  },
  thisYear: {
    label: 'This Year',
    getRange: () => {
      const now = new Date()
      return {
        start: formatDateISO(new Date(now.getFullYear(), 0, 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastYear: {
    label: 'Last Year',
    getRange: () => {
      const now = new Date()
      const y = now.getFullYear() - 1
      return {
        start: formatDateISO(new Date(y, 0, 1)),
        end: formatDateISO(new Date(y, 11, 31)),
      }
    },
  },
  allTime: {
    label: 'All Time',
    getRange: () => ({ start: '', end: '' }),
  },
}

// ── Schema enum values (mirrored from schema.ts for client use) ──────────────

const QUERY_TYPES = ['report', 'entity', 'metric', 'search', 'analyze', 'compare'] as const

const REPORT_TYPES = [
  'trial_balance',
  'profit_loss',
  'balance_sheet',
  'cash_flow',
  'aged_receivables',
  'aged_payables',
  'sales_by_customer',
  'purchases_by_vendor',
  'inventory_valuation',
  'monthly_pnl_trend',
  'sales_by_item',
  'purchases_by_item',
] as const

const ENTITY_TYPES = [
  'customer',
  'vendor',
  'item',
  'account',
  'sales_invoice',
  'purchase_invoice',
  'general_ledger_entry',
  'bank_account',
] as const

const METRIC_NAMES = [
  'current_ratio',
  'quick_ratio',
  'debt_to_equity',
  'working_capital',
  'gross_margin',
  'net_margin',
  'dso',
  'dpo',
  'inventory_turnover',
  'cash_conversion_cycle',
  'total_revenue',
  'total_expenses',
  'net_income',
  'total_assets',
  'total_liabilities',
  'total_equity',
] as const

const PERIODS = [
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'ytd',
  'last_30_days',
  'last_90_days',
] as const

const SEARCH_SCOPES = ['all', 'customers', 'vendors', 'items', 'accounts'] as const
const SUMMARIZE_BY = ['month', 'quarter', 'year'] as const
const ANALYSIS_TYPES = ['trends', 'anomalies', 'breakdown', 'performance'] as const
const FOCUS_AREAS = ['revenue', 'expenses', 'cash_flow', 'profitability', 'inventory'] as const

// ── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  result: any
  durationMs: number
  requestPayload: any
  connection: {
    connectionId: string
    companyName: string
    environmentName: string
    currency: string
  }
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatLabel = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${value.toLocaleString()}`
  }
}

const formatCompact = (v: number) => {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

const CHART_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#f97316',
]

const DARK_TOOLTIP = {
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  borderColor: 'transparent',
  textStyle: { color: '#e5e7eb' },
  confine: true,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BCAgentTestPage() {
  const { connectionId: selectedConnectionId } = useBCOAuthDev()

  // Date period state
  const [selectedPreset, setSelectedPreset] = useState<string>('lastYear')

  // Form state
  const [queryType, setQueryType] = useState<(typeof QUERY_TYPES)[number]>('report')
  const [reportType, setReportType] = useState<string>('profit_loss')
  const [entityType, setEntityType] = useState<string>('customer')
  const [metricName, setMetricName] = useState<string>('current_ratio')
  const [period, setPeriod] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [summarizeBy, setSummarizeBy] = useState<string>('')
  const [limit, setLimit] = useState<string>('100')
  const [searchText, setSearchText] = useState<string>('')
  const [searchScope, setSearchScope] = useState<string>('all')
  const [analysisType, setAnalysisType] = useState<string>('trends')
  const [focusArea, setFocusArea] = useState<string>('revenue')

  // Compare dates
  const [currentStartDate, setCurrentStartDate] = useState<string>('')
  const [currentEndDate, setCurrentEndDate] = useState<string>('')
  const [comparisonStartDate, setComparisonStartDate] = useState<string>('')
  const [comparisonEndDate, setComparisonEndDate] = useState<string>('')

  // Filters
  const [customerName, setCustomerName] = useState<string>('')
  const [vendorName, setVendorName] = useState<string>('')
  const [itemNo, setItemNo] = useState<string>('')
  const [itemName, setItemName] = useState<string>('')
  const [itemCategory, setItemCategory] = useState<string>('')
  const [department, setDepartment] = useState<string>('')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [accountCategory, setAccountCategory] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')

  // Result state
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPayload, setShowPayload] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [showJson, setShowJson] = useState(false)

  // ── Initialize dates on mount ───────────────────────────────────────────────

  useEffect(() => {
    const preset = DATE_PRESETS['lastYear']
    if (preset) {
      const { start, end } = preset.getRange()
      setStartDate(start)
      setEndDate(end)
    }
  }, [])

  const applyPreset = useCallback((key: string) => {
    setSelectedPreset(key)
    const preset = DATE_PRESETS[key]
    if (preset) {
      const { start, end } = preset.getRange()
      setStartDate(start)
      setEndDate(end)
    }
  }, [])

  // ── Build payload ──────────────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const payload: Record<string, any> = { queryType }

    // Type-specific fields
    if (queryType === 'report') {
      payload.reportType = reportType
    } else if (queryType === 'entity') {
      payload.entityType = entityType
    } else if (queryType === 'metric') {
      payload.metricName = metricName
    } else if (queryType === 'search') {
      if (searchText) payload.searchText = searchText
      payload.searchScope = searchScope
    } else if (queryType === 'analyze') {
      payload.analysisType = analysisType
      payload.focusArea = focusArea
    } else if (queryType === 'compare') {
      payload.compareType = 'period'
      if (currentStartDate) payload.currentStartDate = currentStartDate
      if (currentEndDate) payload.currentEndDate = currentEndDate
      if (comparisonStartDate) payload.comparisonStartDate = comparisonStartDate
      if (comparisonEndDate) payload.comparisonEndDate = comparisonEndDate
    }

    // Shared fields
    if (period) payload.period = period
    if (startDate) payload.startDate = startDate
    if (endDate) payload.endDate = endDate
    if (summarizeBy) payload.summarizeBy = summarizeBy
    if (limit) payload.limit = parseInt(limit, 10)

    // Filters (only include non-empty ones)
    const filters: Record<string, any> = {}
    if (customerName) filters.customerName = customerName
    if (vendorName) filters.vendorName = vendorName
    if (itemNo) filters.itemNo = itemNo
    if (itemName) filters.itemName = itemName
    if (itemCategory) filters.itemCategory = itemCategory
    if (department) filters.department = department
    if (accountCategory) filters.accountCategory = accountCategory
    if (accountName) filters.accountName = accountName
    if (minAmount) filters.minAmount = parseFloat(minAmount)
    if (maxAmount) filters.maxAmount = parseFloat(maxAmount)
    if (Object.keys(filters).length > 0) payload.filters = filters

    return payload
  }, [
    queryType,
    reportType,
    entityType,
    metricName,
    period,
    startDate,
    endDate,
    summarizeBy,
    limit,
    searchText,
    searchScope,
    analysisType,
    focusArea,
    currentStartDate,
    currentEndDate,
    comparisonStartDate,
    comparisonEndDate,
    customerName,
    vendorName,
    itemNo,
    itemName,
    itemCategory,
    department,
    minAmount,
    maxAmount,
    accountCategory,
    accountName,
  ])

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!selectedConnectionId) {
      setError('Select a connection first')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    const payload = buildPayload()

    try {
      const res = await fetch(
        `/api/dev/bc-agent-diagnostic?connectionId=${encodeURIComponent(selectedConnectionId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setResult(data)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [selectedConnectionId, buildPayload])

  // ── Copy result ────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result.result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Query Builder */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
        <h2 className="text-lg font-medium text-zinc-100">Query Builder</h2>

        {/* Report Type */}
        {queryType === 'report' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Report Type</label>
            <div className="flex flex-wrap gap-2">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt}
                  onClick={() => setReportType(rt)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    reportType === rt
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'border-white/10 text-zinc-400 hover:bg-white/5'
                  )}
                >
                  {formatLabel(rt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entity Type */}
        {queryType === 'entity' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Entity Type</label>
            <div className="flex flex-wrap gap-2">
              {ENTITY_TYPES.map((et) => (
                <button
                  key={et}
                  onClick={() => setEntityType(et)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    entityType === et
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'border-white/10 text-zinc-400 hover:bg-white/5'
                  )}
                >
                  {formatLabel(et)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metric Name */}
        {queryType === 'metric' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Metric</label>
            <div className="flex flex-wrap gap-2">
              {METRIC_NAMES.map((mn) => (
                <button
                  key={mn}
                  onClick={() => setMetricName(mn)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    metricName === mn
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'border-white/10 text-zinc-400 hover:bg-white/5'
                  )}
                >
                  {formatLabel(mn)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        {queryType === 'search' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Search Scope</label>
              <div className="flex flex-wrap gap-2">
                {SEARCH_SCOPES.map((ss) => (
                  <button
                    key={ss}
                    onClick={() => setSearchScope(ss)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
                      searchScope === ss
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {ss}
                  </button>
                ))}
              </div>
            </div>
            <InputField
              label="Search Text"
              value={searchText}
              onChange={setSearchText}
              placeholder="e.g. fish, salmon"
            />
          </div>
        )}

        {/* Analyze */}
        {queryType === 'analyze' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Analysis Type</label>
              <div className="flex flex-wrap gap-2">
                {ANALYSIS_TYPES.map((at) => (
                  <button
                    key={at}
                    onClick={() => setAnalysisType(at)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
                      analysisType === at
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {at}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Focus Area</label>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((fa) => (
                  <button
                    key={fa}
                    onClick={() => setFocusArea(fa)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      focusArea === fa
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {formatLabel(fa)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compare */}
        {queryType === 'compare' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Current Start</label>
              <input
                type="date"
                value={currentStartDate}
                onChange={(e) => setCurrentStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Current End</label>
              <input
                type="date"
                value={currentEndDate}
                onChange={(e) => setCurrentEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Comparison Start</label>
              <input
                type="date"
                value={comparisonStartDate}
                onChange={(e) => setComparisonStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Comparison End</label>
              <input
                type="date"
                value={comparisonEndDate}
                onChange={(e) => setComparisonEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        )}

        {/* Date Period */}
        <div className="border-t border-white/10 pt-5 space-y-4">
          <h3 className="text-base font-medium text-zinc-200">Date Period</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DATE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors',
                  selectedPreset === key
                    ? 'bg-blue-600 text-white'
                    : 'border border-white/10 text-zinc-400 hover:bg-white/5'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setSelectedPreset('custom')
                }}
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setSelectedPreset('custom')
                }}
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Limit */}
        <div className="border-t border-white/10 pt-5">
          <div className="w-32">
            <label className="block text-sm text-zinc-400 mb-1">Limit</label>
            <input
              type="text"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="100"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Filters — only show fields relevant to the selected report/entity type */}
        {(() => {
          const showCustomer =
            (queryType === 'report' &&
              ['sales_by_customer', 'aged_receivables'].includes(reportType)) ||
            (queryType === 'entity' && entityType === 'customer')
          const showVendor =
            (queryType === 'report' &&
              ['purchases_by_vendor', 'aged_payables'].includes(reportType)) ||
            (queryType === 'entity' && entityType === 'vendor')
          const showItem =
            (queryType === 'report' &&
              ['inventory_valuation', 'sales_by_item', 'purchases_by_item'].includes(reportType)) ||
            (queryType === 'entity' && entityType === 'item')
          const showAmount =
            queryType === 'report' &&
            [
              'sales_by_customer',
              'purchases_by_vendor',
              'sales_by_item',
              'purchases_by_item',
            ].includes(reportType)
          const showAccount =
            queryType === 'report' &&
            [
              'trial_balance',
              'profit_loss',
              'monthly_pnl_trend',
              'balance_sheet',
              'cash_flow',
            ].includes(reportType)
          const hasAny = showCustomer || showVendor || showItem || showAmount || showAccount

          if (!hasAny) return null

          return (
            <div className="border-t border-white/10 pt-5 space-y-4">
              <h3 className="text-base font-medium text-zinc-200">Filters</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {showCustomer && (
                  <InputField
                    label="Customer Name"
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="partial match"
                  />
                )}
                {showVendor && (
                  <InputField
                    label="Vendor Name"
                    value={vendorName}
                    onChange={setVendorName}
                    placeholder="partial match"
                  />
                )}
                {showItem && (
                  <>
                    <InputField
                      label="Item No"
                      value={itemNo}
                      onChange={setItemNo}
                      placeholder="e.g. PE122"
                    />
                    <InputField
                      label="Item Name"
                      value={itemName}
                      onChange={setItemName}
                      placeholder="partial match"
                    />
                    <InputField
                      label="Item Category"
                      value={itemCategory}
                      onChange={setItemCategory}
                      placeholder="e.g. SMART WATCH"
                    />
                  </>
                )}
                {showAccount && (
                  <>
                    <InputField
                      label="Account Name"
                      value={accountName}
                      onChange={setAccountName}
                      placeholder="e.g. Rent, Sales"
                    />
                    <InputField
                      label="Account Category"
                      value={accountCategory}
                      onChange={setAccountCategory}
                      placeholder="e.g. Income, Expense"
                    />
                  </>
                )}
                {showAmount && (
                  <>
                    <InputField
                      label="Min Amount"
                      value={minAmount}
                      onChange={setMinAmount}
                      placeholder="number"
                    />
                    <InputField
                      label="Max Amount"
                      value={maxAmount}
                      onChange={setMaxAmount}
                      placeholder="number"
                    />
                  </>
                )}
              </div>
            </div>
          )
        })()}

        {/* Submit */}
        <div className="border-t border-white/10 pt-5 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedConnectionId}
            className={cn(
              'px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
              loading || !selectedConnectionId
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            )}
          >
            {loading ? 'Running...' : 'Execute Query'}
          </button>
          <button
            onClick={() => setShowPayload(!showPayload)}
            className="px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-white/10 hover:bg-white/5 transition-colors"
          >
            {showPayload ? 'Hide' : 'Show'} Payload
          </button>
        </div>

        {/* Payload preview */}
        {showPayload && (
          <pre className="bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-zinc-300 overflow-auto max-h-60 font-mono">
            {JSON.stringify(buildPayload(), null, 2)}
          </pre>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-zinc-100">Result</h2>
              <span className="text-xs font-mono text-zinc-500">{result.durationMs}ms</span>
              {result.connection && (
                <span className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                  {result.connection.companyName} ({result.connection.currency})
                </span>
              )}
              {result.result?.success === true && (
                <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                  success
                </span>
              )}
              {result.result?.success === false && (
                <span className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 rounded-md border border-red-500/20">
                  failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowMarkdown((v) => !v)
                  setShowJson(false)
                }}
                className={cn(
                  'px-3.5 py-1 text-xs font-medium rounded-full border transition-colors',
                  showMarkdown
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-slate-500/10 border-white/10 text-zinc-500 hover:text-zinc-300'
                )}
              >
                Markdown
              </button>
              <button
                onClick={() => {
                  setShowJson((v) => !v)
                  setShowMarkdown(false)
                }}
                className={cn(
                  'px-3.5 py-1 text-xs font-medium rounded-full border transition-colors',
                  showJson
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-slate-500/10 border-white/10 text-zinc-500 hover:text-zinc-300'
                )}
              >
                JSON
              </button>
              {showJson && (
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
              )}
            </div>
          </div>

          {/* Markdown View */}
          {showMarkdown && <ResultMarkdownView result={result} />}

          {/* JSON View */}
          {showJson && (
            <pre className="mt-4 bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-zinc-300 overflow-auto max-h-[600px] font-mono">
              {JSON.stringify(result.result, null, 2)}
            </pre>
          )}

          {/* Visual View (default — only when no pill is active) */}
          {!showMarkdown && !showJson && (
            <div className="mt-4">
              <ResultVisualView result={result} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Result View Components ───────────────────────────────────────────────────

function ResultVisualView({ result }: { result: TestResult }) {
  const data = result.result
  if (!data) return null
  const currency = result.connection?.currency || 'USD'
  const reportType = data.reportType

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      {data.summary && (() => {
        const entries = Object.entries(data.summary)
          .filter(([key, value]) => {
            if (value === null || value === undefined || typeof value === 'object') return false
            // Hide balance sheet helper field
            if (key === 'totalLiabilitiesPlusEquity') return false
            // Hide zero-value credit memo and returns fields to reduce noise
            if (
              value === 0 &&
              (key.toLowerCase().includes('creditmemo') || key.toLowerCase().includes('returns'))
            )
              return false
            // For P&L reports, hide fields shown in the custom margin KPI cards below
            if (
              ['profit_loss', 'monthly_pnl_trend'].includes(reportType) &&
              ['grossProfit', 'netIncome', 'operatingIncome'].includes(key)
            )
              return false
            return true
          })
        const cols = entries.length <= 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'
        return (
          <div className={`grid grid-cols-2 ${cols} gap-3`}>
            {entries.map(([key, value]) => (
              <div key={key} className="p-3.5 bg-white/[0.03] rounded-lg border border-white/10">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">{formatLabel(key)}</p>
                <p className="text-lg text-zinc-100 font-mono mt-1 font-semibold">
                  {typeof value === 'number'
                    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : String(value)}
                </p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Report-type-specific visuals */}
      {reportType === 'trial_balance' && <TrialBalanceVisuals data={data} currency={currency} />}
      {(reportType === 'profit_loss' || reportType === 'monthly_pnl_trend') && (
        <PnLVisuals data={data} currency={currency} />
      )}
      {reportType === 'balance_sheet' && <BSVisuals data={data} currency={currency} />}
      {reportType === 'cash_flow' && <CashFlowVisuals data={data} currency={currency} />}
      {reportType === 'inventory_valuation' && <InventoryVisuals data={data} currency={currency} />}
      {reportType === 'aged_receivables' && (
        <AgedReceivablesVisuals data={data} currency={currency} />
      )}
      {reportType === 'aged_payables' && <AgedPayablesVisuals data={data} currency={currency} />}
      {reportType === 'sales_by_customer' && (
        <SalesByCustomerVisuals data={data} currency={currency} />
      )}
      {reportType === 'purchases_by_vendor' && (
        <PurchasesByVendorVisuals data={data} currency={currency} />
      )}
      {reportType === 'sales_by_item' && <SalesByItemVisuals data={data} currency={currency} />}
      {reportType === 'purchases_by_item' && (
        <PurchasesByItemVisuals data={data} currency={currency} />
      )}
    </div>
  )
}

function TrialBalanceAccountsTable({ data, currency }: { data: any; currency: string }) {
  if (!data.accounts?.list?.length) return null
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">
        Accounts ({data.accounts.list.length})
      </h3>
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              <th className="py-2 px-3">Number</th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3 text-right">Debit</th>
              <th className="py-2 px-3 text-right">Credit</th>
              <th className="py-2 px-3 text-right">Net Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.accounts.list.map((acc: any, i: number) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="py-2 px-3 text-zinc-400 font-mono text-xs">{acc.number}</td>
                <td className="py-2 px-3 text-zinc-200">{acc.name}</td>
                <td className="py-2 px-3 text-zinc-400">{acc.category}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                  {formatCurrency(acc.debit, currency)}
                </td>
                <td className="py-2 px-3 text-right text-red-400 font-mono">
                  {formatCurrency(acc.credit, currency)}
                </td>
                <td
                  className={cn(
                    'py-2 px-3 text-right font-mono',
                    acc.netBalance < 0 ? 'text-red-400' : 'text-zinc-200'
                  )}
                >
                  {formatCurrency(acc.netBalance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrialBalanceVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const isFiltered =
    data.accounts?.list?.length > 0 &&
    data.accounts.list.length < (data.accounts.total || data.accounts.list.length)

  // Debit vs Credit bar chart
  const debitCreditOption = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: ['Total Debits', 'Total Credits', 'Net Balance'],
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: summary.totalDebits, itemStyle: { color: '#10b981' } },
          { value: summary.totalCredits, itemStyle: { color: '#ef4444' } },
          {
            value: summary.netBalance,
            itemStyle: { color: summary.netBalance >= 0 ? '#3b82f6' : '#f59e0b' },
          },
        ],
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCurrency(p.value, currency),
        },
      },
    ],
  }

  // Category breakdown bar chart
  const byCategory = data.byCategory || []
  const categoryOption = byCategory.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          trigger: 'axis' as const,
          formatter: (params: any) => {
            const cat = params[0]?.name || ''
            return params
              .map((p: any) => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value, currency)}`)
              .join('<br/>')
          },
        },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          icon: 'circle',
        },
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: byCategory.map((c: any) => c.category),
          axisLabel: { color: '#9ca3af', fontSize: 11, rotate: byCategory.length > 4 ? 30 : 0 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            name: 'Debits',
            type: 'bar',
            data: byCategory.map((c: any) => c.totalDebits),
            itemStyle: { color: '#10b981' },
            barMaxWidth: 40,
          },
          {
            name: 'Credits',
            type: 'bar',
            data: byCategory.map((c: any) => c.totalCredits),
            itemStyle: { color: '#ef4444' },
            barMaxWidth: 40,
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Accounts table — top when filtered */}
      {isFiltered && <TrialBalanceAccountsTable data={data} currency={currency} />}

      {/* Balance check indicator */}
      <div
        className={cn(
          'rounded-lg border p-3 flex items-center gap-3',
          summary.isBalanced
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-red-500/5 border-red-500/20'
        )}
      >
        <span className={cn('text-lg', summary.isBalanced ? 'text-emerald-400' : 'text-red-400')}>
          {summary.isBalanced ? '\u2713' : '\u2717'}
        </span>
        <span className={cn('text-sm', summary.isBalanced ? 'text-emerald-300' : 'text-red-300')}>
          {summary.isBalanced
            ? 'Trial balance is balanced — debits equal credits'
            : `Trial balance is out of balance by ${formatCurrency(Math.abs(summary.netBalance), currency)}`}
        </span>
      </div>

      {/* Debit vs Credit bar chart */}
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Debits vs Credits</h3>
        <ReactECharts
          option={debitCreditOption}
          style={{ height: 320 }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Category breakdown */}
      {categoryOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">By Category</h3>
          <ReactECharts
            option={categoryOption}
            style={{ height: 320 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )}

      {/* Category summary table */}
      {byCategory.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Category Summary</h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Accounts</th>
                  <th className="py-2 px-3 text-right">Debits</th>
                  <th className="py-2 px-3 text-right">Credits</th>
                  <th className="py-2 px-3 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {byCategory.map((cat: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-200">{cat.category}</td>
                    <td className="py-2 px-3 text-right text-zinc-400 font-mono">{cat.count}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                      {formatCurrency(cat.totalDebits, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">
                      {formatCurrency(cat.totalCredits, currency)}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono',
                        cat.netBalance < 0 ? 'text-red-400' : 'text-zinc-200'
                      )}
                    >
                      {formatCurrency(cat.netBalance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accounts table — bottom when not filtered */}
      {!isFiltered && <TrialBalanceAccountsTable data={data} currency={currency} />}
    </div>
  )
}

function BSAccountsTable({ data, currency }: { data: any; currency: string }) {
  if (!data.accounts?.list?.length) return null
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">
        Accounts ({data.accounts.list.length})
      </h3>
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              <th className="py-2 px-3">Number</th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Section</th>
              <th className="py-2 px-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.accounts.list.map((acc: any, i: number) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="py-2 px-3 text-zinc-400 font-mono text-xs">{acc.number}</td>
                <td className="py-2 px-3 text-zinc-200">{acc.name}</td>
                <td className="py-2 px-3 text-zinc-400">{acc.section}</td>
                <td
                  className={cn(
                    'py-2 px-3 text-right font-mono',
                    acc.displayBalance < 0 ? 'text-red-400' : 'text-zinc-200'
                  )}
                >
                  {formatCurrency(acc.displayBalance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BSVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const isFiltered =
    data.accounts?.list?.length > 0 &&
    data.accounts.list.length < (data.accounts.bsAccounts || data.accounts.list.length)

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: ['Assets', 'Liabilities', 'Equity', 'Balance Check'],
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: summary.totalAssets, itemStyle: { color: '#10b981' } },
          { value: summary.totalLiabilities, itemStyle: { color: '#ef4444' } },
          { value: summary.totalEquity, itemStyle: { color: '#3b82f6' } },
          {
            value: summary.balanceCheck,
            itemStyle: { color: summary.balanceCheck === 0 ? '#10b981' : '#f59e0b' },
          },
        ],
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCurrency(p.value, currency),
        },
      },
    ],
  }

  return (
    <div className="space-y-4">
      {/* Accounts table — top priority when filtered */}
      {isFiltered && <BSAccountsTable data={data} currency={currency} />}

      {/* Section counts */}
      {data.accounts?.bySectionCount && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Accounts by Section</h3>
          <div className="space-y-2">
            {Object.entries(data.accounts.bySectionCount).map(([section, count]) => (
              <div key={section} className="flex justify-between text-sm">
                <span className="text-zinc-400">{section}</span>
                <span className="text-zinc-100 font-mono">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance sheet bar chart */}
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Balance Sheet Breakdown</h3>
        <ReactECharts option={barOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
      </div>

      {/* Accounts table — at bottom when not filtered */}
      {!isFiltered && <BSAccountsTable data={data} currency={currency} />}
    </div>
  )
}

function CashFlowAccountsTable({ data, currency }: { data: any; currency: string }) {
  if (!data.accounts?.list?.length) return null

  const allAccounts: any[] = data.accounts.list
  const [activityFilter, setActivityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Derive unique activities and categories from data
  const activities = [
    'all',
    ...Array.from(new Set<string>(allAccounts.map((a) => a.activity).filter(Boolean))).sort(),
  ]
  const categories = [
    'all',
    ...Array.from(new Set<string>(allAccounts.map((a) => a.category).filter(Boolean))).sort(),
  ]

  const filtered = allAccounts.filter((a) => {
    if (activityFilter !== 'all' && a.activity !== activityFilter) return false
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
    return true
  })

  const activityColor = (activity: string, active: boolean) => {
    if (!active)
      return 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/10'
    if (activity === 'operating')
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    if (activity === 'investing') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    if (activity === 'financing')
      return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
    return 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
  }

  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      {/* Header row with title + filters */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-zinc-300">
          Accounts ({filtered.length}
          {filtered.length !== allAccounts.length ? ` of ${allAccounts.length}` : ''})
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {/* Activity filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 bg-white/[0.06] px-2 py-0.5 rounded border border-white/10">
              Activity
            </span>
            {activities.map((a) => (
              <button
                key={a}
                onClick={() => setActivityFilter(a)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition-colors capitalize',
                  activityFilter === a ? activityColor(a, true) : activityColor(a, false)
                )}
              >
                {a === 'all' ? 'All' : a}
              </button>
            ))}
          </div>
          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 bg-white/[0.06] px-2 py-0.5 rounded border border-white/10">
              Category
            </span>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                  categoryFilter === c
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/10'
                )}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              <th className="py-2 px-3">Number</th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Activity</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((acc: any, i: number) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="py-2 px-3 text-zinc-400 font-mono text-xs">{acc.number}</td>
                <td className="py-2 px-3 text-zinc-200">{acc.name}</td>
                <td className="py-2 px-3">
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      acc.activity === 'operating'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : acc.activity === 'investing'
                          ? 'bg-blue-500/10 text-blue-400'
                          : acc.activity === 'financing'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-amber-500/10 text-amber-400'
                    )}
                  >
                    {acc.activity}
                  </span>
                </td>
                <td className="py-2 px-3 text-zinc-400">{acc.category}</td>
                <td
                  className={cn(
                    'py-2 px-3 text-right font-mono',
                    acc.amount < 0 ? 'text-red-400' : 'text-zinc-200'
                  )}
                >
                  {formatCurrency(acc.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CashFlowVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const isFiltered =
    data.accounts?.list?.length > 0 &&
    data.accounts.list.length < (data.accounts.total || data.accounts.list.length)

  // Waterfall chart: Beginning → +Operating → +Investing → +Financing → Ending
  const waterfallOption = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: ['Beginning Cash', 'Operating', 'Investing', 'Financing', 'Ending Cash'],
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: summary.beginningCash, itemStyle: { color: '#6b7280' } },
          {
            value: summary.totalOperating,
            itemStyle: { color: summary.totalOperating >= 0 ? '#10b981' : '#ef4444' },
          },
          {
            value: summary.totalInvesting,
            itemStyle: { color: summary.totalInvesting >= 0 ? '#3b82f6' : '#ef4444' },
          },
          {
            value: summary.totalFinancing,
            itemStyle: { color: summary.totalFinancing >= 0 ? '#8b5cf6' : '#ef4444' },
          },
          {
            value: summary.endingCash,
            itemStyle: { color: summary.endingCash >= 0 ? '#10b981' : '#ef4444' },
          },
        ],
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCurrency(p.value, currency),
        },
      },
    ],
  }

  // Activity breakdown helper
  const ActivitySection = ({
    title,
    color,
    items,
  }: {
    title: string
    color: string
    items: { label: string; value: number }[]
  }) => (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className={cn('text-sm font-medium mb-3', color)}>{title}</h3>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-zinc-400">{item.label}</span>
            <span className={cn('font-mono', item.value < 0 ? 'text-red-400' : 'text-zinc-100')}>
              {formatCurrency(item.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Accounts table — top when filtered */}
      {isFiltered && <CashFlowAccountsTable data={data} currency={currency} />}

      {/* Waterfall chart */}
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Cash Flow Summary</h3>
        <ReactECharts
          option={waterfallOption}
          style={{ height: 320 }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Activity breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.operatingActivities && (
          <ActivitySection
            title="Operating Activities"
            color="text-emerald-400"
            items={[
              { label: 'Net Income', value: data.operatingActivities.netIncome },
              { label: 'Depreciation', value: data.operatingActivities.depreciation },
              { label: 'AR Change', value: data.operatingActivities.arChange },
              { label: 'Inventory Change', value: data.operatingActivities.inventoryChange },
              { label: 'AP Change', value: data.operatingActivities.apChange },
              { label: 'Other Operating', value: data.operatingActivities.otherOperating },
              { label: 'Total Operating', value: data.operatingActivities.totalOperating },
            ]}
          />
        )}
        {data.investingActivities && (
          <ActivitySection
            title="Investing Activities"
            color="text-blue-400"
            items={[
              {
                label: 'Capital Expenditures',
                value: data.investingActivities.capitalExpenditures,
              },
              { label: 'Asset Sales', value: data.investingActivities.assetSales },
              { label: 'Other Investing', value: data.investingActivities.otherInvesting },
              { label: 'Total Investing', value: data.investingActivities.totalInvesting },
            ]}
          />
        )}
        {data.financingActivities && (
          <ActivitySection
            title="Financing Activities"
            color="text-purple-400"
            items={[
              { label: 'Debt Proceeds', value: data.financingActivities.debtProceeds },
              { label: 'Debt Repayments', value: data.financingActivities.debtRepayments },
              { label: 'Equity Changes', value: data.financingActivities.equityChanges },
              { label: 'Total Financing', value: data.financingActivities.totalFinancing },
            ]}
          />
        )}
      </div>

      {/* Accounts table — bottom when not filtered */}
      {!isFiltered && <CashFlowAccountsTable data={data} currency={currency} />}
    </div>
  )
}

function AgedReceivablesVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const buckets = [
    { label: 'Current', value: summary.current, color: '#10b981' },
    { label: '1-30 Days', value: summary.days_1_30, color: '#3b82f6' },
    { label: '31-60 Days', value: summary.days_31_60, color: '#f59e0b' },
    { label: '61-90 Days', value: summary.days_61_90, color: '#f97316' },
    { label: 'Over 90 Days', value: summary.days_over_90, color: '#ef4444' },
  ]

  const agingBarOption = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: buckets.map((b) => b.label),
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'bar',
        data: buckets.map((b) => ({ value: b.value, itemStyle: { color: b.color } })),
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCurrency(p.value, currency),
        },
      },
    ],
  }

  // Top customers pie chart
  const topCustomers = data.topCustomers || []
  const pieOption = topCustomers.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          itemGap: 16,
          icon: 'circle',
        },
        series: [
          {
            type: 'pie',
            radius: ['30%', '55%'],
            center: ['50%', '42%'],
            data: topCustomers.map((c: any, i: number) => ({
              name: c.name,
              value: Math.round(c.total),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Aging buckets bar chart */}
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Aging Buckets</h3>
        <ReactECharts
          option={agingBarOption}
          style={{ height: 320 }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Charts row: pie + top customers table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Customers by Balance</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {topCustomers.length > 0 && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Customers ({topCustomers.length})
            </h3>
            <div className="space-y-2">
              {topCustomers.map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {c.name} <span className="text-zinc-600 text-xs">({c.invoiceCount} inv)</span>
                  </span>
                  <span className="text-zinc-100 font-mono">
                    {formatCurrency(c.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invoice table */}
      {data.invoices?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            Open Invoices ({data.invoices.length})
          </h3>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Due Date</th>
                  <th className="py-2 px-3 text-right">Days Past Due</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.invoices.map((inv: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-400 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">{inv.customerName}</td>
                    <td className="py-2 px-3 text-zinc-400">{inv.dueDate}</td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono',
                        inv.daysPastDue > 90
                          ? 'text-red-400'
                          : inv.daysPastDue > 30
                            ? 'text-amber-400'
                            : 'text-zinc-200'
                      )}
                    >
                      {inv.daysPastDue}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(inv.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AgedPayablesVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const buckets = [
    { label: 'Current', value: summary.current, color: '#10b981' },
    { label: '1-30 Days', value: summary.days_1_30, color: '#3b82f6' },
    { label: '31-60 Days', value: summary.days_31_60, color: '#f59e0b' },
    { label: '61-90 Days', value: summary.days_61_90, color: '#f97316' },
    { label: 'Over 90 Days', value: summary.days_over_90, color: '#ef4444' },
  ]

  const agingBarOption = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: buckets.map((b) => b.label),
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'bar',
        data: buckets.map((b) => ({ value: b.value, itemStyle: { color: b.color } })),
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCurrency(p.value, currency),
        },
      },
    ],
  }

  // Top vendors pie chart
  const topVendors = data.topVendors || []
  const pieOption = topVendors.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          itemGap: 16,
          icon: 'circle',
        },
        series: [
          {
            type: 'pie',
            radius: ['30%', '55%'],
            center: ['50%', '42%'],
            data: topVendors.map((v: any, i: number) => ({
              name: v.name,
              value: Math.round(v.total),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Aging buckets bar chart */}
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Aging Buckets</h3>
        <ReactECharts
          option={agingBarOption}
          style={{ height: 320 }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Charts row: pie + top vendors table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Vendors by Balance</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {topVendors.length > 0 && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Vendors ({topVendors.length})
            </h3>
            <div className="space-y-2">
              {topVendors.map((v: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {v.name} <span className="text-zinc-600 text-xs">({v.invoiceCount} inv)</span>
                  </span>
                  <span className="text-zinc-100 font-mono">
                    {formatCurrency(v.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invoice table */}
      {data.invoices?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            Open Invoices ({data.invoices.length})
          </h3>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Due Date</th>
                  <th className="py-2 px-3 text-right">Days Past Due</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.invoices.map((inv: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-400 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">{inv.vendorName}</td>
                    <td className="py-2 px-3 text-zinc-400">{inv.dueDate}</td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono',
                        inv.daysPastDue > 90
                          ? 'text-red-400'
                          : inv.daysPastDue > 30
                            ? 'text-amber-400'
                            : 'text-zinc-200'
                      )}
                    >
                      {inv.daysPastDue}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(inv.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SalesByCustomerVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'open' | 'paid'>('all')

  const topCustomers = data.topCustomers || []
  const allInvoices: any[] = data.invoices || []
  const filteredInvoices =
    invoiceStatusFilter === 'all'
      ? allInvoices
      : allInvoices.filter((inv) => (inv.status || '').toLowerCase() === invoiceStatusFilter)

  // Top customers bar chart
  const barOption = topCustomers.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
        },
        grid: { left: '3%', right: '4%', bottom: '20%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: topCustomers.map((c: any) =>
            c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name
          ),
          axisLabel: { color: '#9ca3af', fontSize: 10, rotate: 30, interval: 0 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            data: topCustomers.map((c: any, i: number) => ({
              value: c.total,
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            barMaxWidth: 50,
            label: {
              show: true,
              position: 'top',
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCurrency(p.value, currency),
            },
          },
        ],
      }
    : null

  // Pie chart of top customers share
  const pieOption = topCustomers.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          itemGap: 16,
          icon: 'circle',
        },
        series: [
          {
            type: 'pie',
            radius: ['30%', '55%'],
            center: ['50%', '42%'],
            data: topCustomers.map((c: any, i: number) => ({
              name: c.name,
              value: Math.round(c.total),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Top customers bar chart */}
      {barOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Customers by Net Sales</h3>
          <ReactECharts option={barOption} style={{ height: 340 }} opts={{ renderer: 'canvas' }} />
        </div>
      )}

      {/* Charts row: pie + top customers list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Revenue Share</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {topCustomers.length > 0 && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Customers ({topCustomers.length})
            </h3>
            <div className="space-y-2">
              {topCustomers.map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {c.name} <span className="text-zinc-600 text-xs">({c.invoiceCount} inv)</span>
                  </span>
                  <span className="text-zinc-100 font-mono">
                    {formatCurrency(c.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Customers table */}
      {data.customers?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            All Customers ({data.customers.length})
          </h3>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">No.</th>
                  <th className="py-2 px-3 text-right">Invoices</th>
                  <th className="py-2 px-3 text-right">Total Sales</th>
                  <th className="py-2 px-3 text-right">Returns</th>
                  <th className="py-2 px-3 text-right">Net Sales</th>
                  <th className="py-2 px-3 text-right">AR Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.customers.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-200">{c.customerName}</td>
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">
                      {c.customerNumber}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-400 font-mono">
                      {c.invoiceCount}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(c.totalSales, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">
                      {c.totalReturns > 0 ? `-${formatCurrency(c.totalReturns, currency)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono font-medium',
                        c.netSales < 0 ? 'text-red-400' : 'text-emerald-400'
                      )}
                    >
                      {formatCurrency(c.netSales, currency)}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono',
                        c.arBalance == null
                          ? 'text-zinc-600'
                          : c.arBalance < 0
                            ? 'text-red-400'
                            : c.arBalance === 0
                              ? 'text-zinc-500'
                              : 'text-amber-400'
                      )}
                    >
                      {c.arBalance == null ? '—' : formatCurrency(c.arBalance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices table */}
      {allInvoices.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-300">
              Invoices ({filteredInvoices.length}
              {invoiceStatusFilter !== 'all' ? ` of ${allInvoices.length}` : ''})
            </h3>
            <div className="flex gap-1">
              {(['all', 'open', 'paid'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setInvoiceStatusFilter(s)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    invoiceStatusFilter === s
                      ? s === 'open'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : s === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/10'
                  )}
                >
                  {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Paid'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Posting Date</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInvoices.map((inv: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-400 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">{inv.customerName}</td>
                    <td className="py-2 px-3 text-zinc-400">{inv.postingDate}</td>
                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          inv.status === 'Open'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        )}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(inv.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit memo note */}
      {data.creditMemos && !data.creditMemos.available && data.creditMemos.error && (
        <p className="text-xs text-zinc-600">
          Note: Credit memos unavailable — {data.creditMemos.error}. Returns excluded from totals.
        </p>
      )}
    </div>
  )
}

function PurchasesByVendorVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'open' | 'paid'>('all')

  const topVendors = data.topVendors || []
  const allInvoices: any[] = data.invoices || []
  const filteredInvoices =
    invoiceStatusFilter === 'all'
      ? allInvoices
      : allInvoices.filter((inv) => (inv.status || '').toLowerCase() === invoiceStatusFilter)

  // Bar chart — top vendors by net purchases
  const barOption = topVendors.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
        },
        grid: { left: '3%', right: '4%', bottom: '20%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: topVendors.map((v: any) =>
            v.name.length > 18 ? v.name.slice(0, 18) + '…' : v.name
          ),
          axisLabel: { color: '#9ca3af', fontSize: 10, rotate: 30, interval: 0 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            data: topVendors.map((v: any, i: number) => ({
              value: v.total,
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            barMaxWidth: 50,
            label: {
              show: true,
              position: 'top',
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCurrency(p.value, currency),
            },
          },
        ],
      }
    : null

  // Pie chart — spend share
  const pieOption = topVendors.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          itemGap: 16,
          icon: 'circle',
        },
        series: [
          {
            type: 'pie',
            radius: ['30%', '55%'],
            center: ['50%', '42%'],
            data: topVendors.map((v: any, i: number) => ({
              name: v.name,
              value: Math.round(v.total),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Top vendors bar chart */}
      {barOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Vendors by Net Purchases</h3>
          <ReactECharts option={barOption} style={{ height: 340 }} opts={{ renderer: 'canvas' }} />
        </div>
      )}

      {/* Pie + top vendors list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Spend Share</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {topVendors.length > 0 && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Vendors ({topVendors.length})
            </h3>
            <div className="space-y-2">
              {topVendors.map((v: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {v.name} <span className="text-zinc-600 text-xs">({v.invoiceCount} inv)</span>
                  </span>
                  <span className="text-zinc-100 font-mono">
                    {formatCurrency(v.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All vendors table */}
      {data.vendors?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            All Vendors ({data.vendors.length})
          </h3>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">No.</th>
                  <th className="py-2 px-3 text-right">Invoices</th>
                  <th className="py-2 px-3 text-right">Total Purchases</th>
                  <th className="py-2 px-3 text-right">Returns</th>
                  <th className="py-2 px-3 text-right">Net Purchases</th>
                  <th className="py-2 px-3 text-right">AP Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.vendors.map((v: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-200">{v.vendorName}</td>
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{v.vendorNumber}</td>
                    <td className="py-2 px-3 text-right text-zinc-400 font-mono">
                      {v.invoiceCount}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(v.totalPurchases, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">
                      {v.totalReturns > 0 ? `-${formatCurrency(v.totalReturns, currency)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono font-medium',
                        v.netPurchases < 0 ? 'text-red-400' : 'text-blue-400'
                      )}
                    >
                      {formatCurrency(v.netPurchases, currency)}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono',
                        v.apBalance == null
                          ? 'text-zinc-600'
                          : v.apBalance < 0
                            ? 'text-red-400'
                            : v.apBalance === 0
                              ? 'text-zinc-500'
                              : 'text-amber-400'
                      )}
                    >
                      {v.apBalance == null ? '—' : formatCurrency(v.apBalance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices table with Open/Paid filter */}
      {allInvoices.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-300">
              Invoices ({filteredInvoices.length}
              {invoiceStatusFilter !== 'all' ? ` of ${allInvoices.length}` : ''})
            </h3>
            <div className="flex gap-1">
              {(['all', 'open', 'paid'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setInvoiceStatusFilter(s)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    invoiceStatusFilter === s
                      ? s === 'open'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : s === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/10'
                  )}
                >
                  {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Paid'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Posting Date</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInvoices.map((inv: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-400 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">{inv.vendorName}</td>
                    <td className="py-2 px-3 text-zinc-400">{inv.postingDate}</td>
                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          inv.status === 'Open'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        )}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(inv.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit memo note */}
      {data.creditMemos && !data.creditMemos.available && data.creditMemos.error && (
        <p className="text-xs text-zinc-600">
          Note: Purchase credit memos unavailable — {data.creditMemos.error}. Returns excluded.
        </p>
      )}
    </div>
  )
}

function SalesByItemVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const topItems = data.topItems || []

  // Bar chart — top items by net sales
  const barOption = topItems.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
        },
        grid: { left: '3%', right: '4%', bottom: '22%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: topItems.map((it: any) =>
            it.name.length > 20 ? it.name.slice(0, 20) + '…' : it.name
          ),
          axisLabel: { color: '#9ca3af', fontSize: 10, rotate: 30, interval: 0 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            data: topItems.map((it: any, i: number) => ({
              value: it.total,
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            barMaxWidth: 50,
            label: {
              show: true,
              position: 'top',
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCurrency(p.value, currency),
            },
          },
        ],
      }
    : null

  // Pie chart — revenue share by item
  // Legend hidden (names too long) — tooltip shows full name on hover
  const pieOption = topItems.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        series: [
          {
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['50%', '50%'],
            data: topItems.map((it: any, i: number) => ({
              name: it.name,
              value: Math.round(it.total),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
            labelLine: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Top items bar chart */}
      {barOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Items by Net Sales</h3>
          <ReactECharts option={barOption} style={{ height: 340 }} opts={{ renderer: 'canvas' }} />
        </div>
      )}

      {/* Pie + top items list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Revenue Share</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {topItems.length > 0 && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Items ({topItems.length})
            </h3>
            <div className="space-y-2">
              {topItems.map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400 truncate max-w-[55%]" title={it.name}>
                    {it.name} <span className="text-zinc-600 text-xs">({it.quantity} units)</span>
                  </span>
                  <span className="text-zinc-100 font-mono">
                    {formatCurrency(it.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All items table */}
      {data.items?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            All Items ({data.items.length})
          </h3>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">No.</th>
                  <th className="py-2 px-3 text-right">Qty Sold</th>
                  <th className="py-2 px-3 text-right">Total Sales</th>
                  <th className="py-2 px-3 text-right">Qty Returned</th>
                  <th className="py-2 px-3 text-right">Returns</th>
                  <th className="py-2 px-3 text-right">Net Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((it: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td
                      className="py-2 px-3 text-zinc-200 max-w-[200px] truncate"
                      title={it.itemName}
                    >
                      {it.itemName}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{it.itemNumber}</td>
                    <td className="py-2 px-3 text-right text-zinc-300 font-mono">
                      {it.totalQuantity.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(it.totalSales, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-500 font-mono">
                      {it.totalReturnQty > 0 ? it.totalReturnQty.toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">
                      {it.totalReturns > 0 ? `-${formatCurrency(it.totalReturns, currency)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono font-medium',
                        it.netSales < 0 ? 'text-red-400' : 'text-emerald-400'
                      )}
                    >
                      {formatCurrency(it.netSales, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit memo note */}
      {data.creditMemos && !data.creditMemos.available && data.creditMemos.error && (
        <p className="text-xs text-zinc-600">
          Note: Credit memo lines unavailable — {data.creditMemos.error}. Returns excluded.
        </p>
      )}
    </div>
  )
}

function PurchasesByItemVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const topItems = data.topItems || []

  // Bar chart — top items by net cost
  const barOption = topItems.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
        },
        grid: { left: '3%', right: '4%', bottom: '22%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: topItems.map((it: any) =>
            it.name.length > 20 ? it.name.slice(0, 20) + '…' : it.name
          ),
          axisLabel: { color: '#9ca3af', fontSize: 10, rotate: 30, interval: 0 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            data: topItems.map((it: any, i: number) => ({
              value: it.total,
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            barMaxWidth: 50,
            label: {
              show: true,
              position: 'top',
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCurrency(p.value, currency),
            },
          },
        ],
      }
    : null

  // Pie chart — spend share by item (legend hidden — names too long)
  const pieOption = topItems.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        series: [
          {
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['50%', '50%'],
            data: topItems.map((it: any, i: number) => ({
              name: it.name,
              value: Math.round(it.total),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
            labelLine: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="space-y-4">
      {/* Top items bar chart */}
      {barOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Items by Net Cost</h3>
          <ReactECharts option={barOption} style={{ height: 340 }} opts={{ renderer: 'canvas' }} />
        </div>
      )}

      {/* Pie + top items list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Spend Share</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {topItems.length > 0 && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Top Items ({topItems.length})
            </h3>
            <div className="space-y-2">
              {topItems.map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-400 truncate max-w-[55%]" title={it.name}>
                    {it.name} <span className="text-zinc-600 text-xs">({it.quantity} units)</span>
                  </span>
                  <span className="text-zinc-100 font-mono">
                    {formatCurrency(it.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All items table */}
      {data.items?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            All Items ({data.items.length})
          </h3>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">No.</th>
                  <th className="py-2 px-3 text-right">Qty Purchased</th>
                  <th className="py-2 px-3 text-right">Total Cost</th>
                  <th className="py-2 px-3 text-right">Qty Returned</th>
                  <th className="py-2 px-3 text-right">Returns</th>
                  <th className="py-2 px-3 text-right">Net Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((it: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td
                      className="py-2 px-3 text-zinc-200 max-w-[200px] truncate"
                      title={it.itemName}
                    >
                      {it.itemName}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">{it.itemNumber}</td>
                    <td className="py-2 px-3 text-right text-zinc-300 font-mono">
                      {it.totalQuantity.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(it.totalCost, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-500 font-mono">
                      {it.totalReturnQty > 0 ? it.totalReturnQty.toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">
                      {it.totalReturns > 0 ? `-${formatCurrency(it.totalReturns, currency)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono font-medium',
                        it.netCost < 0 ? 'text-red-400' : 'text-blue-400'
                      )}
                    >
                      {formatCurrency(it.netCost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit memo note */}
      {data.creditMemos && !data.creditMemos.available && data.creditMemos.error && (
        <p className="text-xs text-zinc-600">
          Note: Credit memo lines unavailable — {data.creditMemos.error}. Returns excluded.
        </p>
      )}
    </div>
  )
}

function PnLAccountsTable({ data, currency }: { data: any; currency: string }) {
  if (!data.accounts?.list?.length) return null
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">
        Accounts ({data.accounts.list.length})
      </h3>
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              <th className="py-2 px-3">Number</th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3 text-right">GL Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.accounts.list.map((acc: any, i: number) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="py-2 px-3 text-zinc-400 font-mono text-xs">{acc.number}</td>
                <td className="py-2 px-3 text-zinc-200">{acc.name}</td>
                <td className="py-2 px-3 text-zinc-400">{acc.category}</td>
                <td
                  className={cn(
                    'py-2 px-3 text-right font-mono',
                    acc.glAmount < 0 ? 'text-red-400' : 'text-zinc-200'
                  )}
                >
                  {formatCurrency(acc.glAmount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PnLVisuals({ data, currency }: { data: any; currency: string }) {
  const summary = data.summary
  if (!summary) return null

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: ['Revenue', 'COGS', 'Gross Profit', 'Expenses', 'Net Income'],
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: summary.totalRevenue, itemStyle: { color: '#10b981' } },
          { value: summary.totalCOGS, itemStyle: { color: '#ef4444' } },
          { value: summary.grossProfit, itemStyle: { color: '#3b82f6' } },
          { value: summary.totalExpenses, itemStyle: { color: '#f59e0b' } },
          {
            value: summary.netIncome,
            itemStyle: { color: summary.netIncome >= 0 ? '#10b981' : '#ef4444' },
          },
        ],
        barMaxWidth: 60,
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCurrency(p.value, currency),
        },
      },
    ],
  }

  // Monthly trend chart (only for monthly_pnl_trend with data)
  const monthlyTrend = data.monthlyTrend
  const trendOption = monthlyTrend?.length
    ? {
        backgroundColor: 'transparent',
        tooltip: { ...DARK_TOOLTIP, trigger: 'axis' as const },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          icon: 'circle',
        },
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: monthlyTrend.map((m: any) => m.month),
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            name: 'Revenue',
            type: 'bar',
            stack: 'pnl',
            data: monthlyTrend.map((m: any) => m.revenue),
            itemStyle: { color: '#10b981' },
            barMaxWidth: 40,
          },
          {
            name: 'COGS',
            type: 'bar',
            stack: 'costs',
            data: monthlyTrend.map((m: any) => m.cogs),
            itemStyle: { color: '#ef4444' },
            barMaxWidth: 40,
          },
          {
            name: 'Expenses',
            type: 'bar',
            stack: 'costs',
            data: monthlyTrend.map((m: any) => m.expenses),
            itemStyle: { color: '#f59e0b' },
            barMaxWidth: 40,
          },
          {
            name: 'Net Income',
            type: 'line',
            data: monthlyTrend.map((m: any) => m.netIncome),
            itemStyle: { color: '#8b5cf6' },
            lineStyle: { width: 2 },
            smooth: true,
          },
        ],
      }
    : null

  // Margin KPI calculations
  const rev = summary.totalRevenue || 0
  const grossProfit = summary.grossProfit ?? 0
  const netIncome = summary.netIncome ?? 0
  // Only use operatingIncome if the backend explicitly provides it
  const hasOpIncome = summary.operatingIncome != null
  const opIncome = summary.operatingIncome ?? 0
  const grossMarginPct = rev !== 0 ? (grossProfit / rev) * 100 : null
  const opMarginPct = hasOpIncome && rev !== 0 ? (opIncome / rev) * 100 : null
  const netMarginPct = rev !== 0 ? (netIncome / rev) * 100 : null

  const fmtPct = (v: number | null) =>
    v === null || !isFinite(v) ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

  // Show accounts table at top when filtered, at bottom otherwise
  const isFiltered =
    data.accounts?.list?.length > 0 &&
    data.accounts.list.length < (data.accounts.plAccounts || data.accounts.list.length)

  return (
    <div className="space-y-4">
      {/* Margin KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Gross Profit',
            amount: grossProfit,
            pct: grossMarginPct,
            color: grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400',
            pctColor: (grossMarginPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
          },
          {
            label: 'Operating Income',
            amount: hasOpIncome ? opIncome : null,
            pct: opMarginPct,
            color: opIncome >= 0 ? 'text-emerald-400' : 'text-red-400',
            pctColor: (opMarginPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
          },
          {
            label: 'Net Income',
            amount: netIncome,
            pct: netMarginPct,
            color: netIncome >= 0 ? 'text-emerald-400' : 'text-red-400',
            pctColor: (netMarginPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white/[0.02] rounded-lg border border-white/10 p-4 flex flex-col gap-1"
          >
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{card.label}</div>
            <div className={cn('text-xl font-mono font-semibold tabular-nums', card.color)}>
              {card.amount === null ? '—' : formatCurrency(card.amount, currency)}
            </div>
            <div className={cn('text-sm font-mono font-medium', card.pctColor)}>
              {card.amount === null ? (
                <span className="text-zinc-600 text-xs">Not available</span>
              ) : (
                <>
                  {fmtPct(card.pct)}{' '}
                  <span className="text-zinc-600 text-xs font-normal">of revenue</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Accounts table — top priority when filtered */}
      {isFiltered && <PnLAccountsTable data={data} currency={currency} />}

      {/* Monthly trend chart (monthly_pnl_trend) */}
      {trendOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Monthly P&L Trend</h3>
          <ReactECharts
            option={trendOption}
            style={{ height: 350 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )}

      {/* Monthly data table */}
      {monthlyTrend?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Monthly Breakdown</h3>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Month</th>
                  <th className="py-2 px-3 text-right">Revenue</th>
                  <th className="py-2 px-3 text-right">COGS</th>
                  <th className="py-2 px-3 text-right">Gross Profit</th>
                  <th className="py-2 px-3 text-right">Expenses</th>
                  <th className="py-2 px-3 text-right">Net Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {monthlyTrend.map((m: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-200 font-mono">{m.month}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                      {formatCurrency(m.revenue, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">
                      {formatCurrency(m.cogs, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-blue-400 font-mono">
                      {formatCurrency(m.grossProfit, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-400 font-mono">
                      {formatCurrency(m.expenses, currency)}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-3 text-right font-mono',
                        m.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {formatCurrency(m.netIncome, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aggregate P&L bar */}
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Profit & Loss Breakdown</h3>
        <ReactECharts option={barOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
      </div>

      {data.accounts?.sectionTotals?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Section Totals</h3>
          <div className="space-y-2">
            {data.accounts.sectionTotals.map((st: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-zinc-400">{st.category}</span>
                <span className="text-zinc-100 font-mono">
                  {formatCurrency(Math.abs(st.total), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts table — at bottom when not filtered */}
      {!isFiltered && <PnLAccountsTable data={data} currency={currency} />}
    </div>
  )
}

function InventoryVisuals({ data, currency }: { data: any; currency: string }) {
  // Donut: value by category
  const pieOption = data.byCategory?.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) =>
            `${p.marker} ${p.name}<br/>${formatCurrency(p.value, currency)} (${p.percent}%)`,
        },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          itemGap: 16,
          icon: 'circle',
        },
        series: [
          {
            type: 'pie',
            radius: ['30%', '55%'],
            center: ['50%', '42%'],
            data: data.byCategory.map((c: any, i: number) => ({
              name: c.category,
              value: Math.round(c.totalValue),
              itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
            })),
            label: { show: false },
          },
        ],
      }
    : null

  // Horizontal bar: top items by value
  const topItems = (data.topByValue || []).slice(0, 10)
  const barOption = topItems.length
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          ...DARK_TOOLTIP,
          formatter: (p: any) => `${p.name}: ${formatCurrency(p.value, currency)}`,
        },
        grid: { left: '3%', right: '15%', bottom: '5%', top: '5%', containLabel: true },
        xAxis: { type: 'value' as const, axisLabel: { show: false }, splitLine: { show: false } },
        yAxis: {
          type: 'category' as const,
          data: topItems.map((i: any) => i.name).reverse(),
          axisLabel: { color: '#9ca3af', fontSize: 11, width: 140, overflow: 'truncate' as const },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        series: [
          {
            type: 'bar',
            data: topItems.map((i: any) => i.totalValue).reverse(),
            itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
            barMaxWidth: 24,
            label: {
              show: true,
              position: 'right',
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCurrency(p.value, currency),
            },
          },
        ],
      }
    : null

  // Movement trend line
  const byMonth = data.movementAnalysis?.byMonth
  const movementOption = byMonth?.length
    ? {
        backgroundColor: 'transparent',
        tooltip: { ...DARK_TOOLTIP, trigger: 'axis' as const },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          icon: 'circle',
        },
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: byMonth.map((m: any) => m.month),
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            name: 'Inbound',
            type: 'line',
            data: byMonth.map((m: any) => m.inbound),
            itemStyle: { color: '#10b981' },
            smooth: true,
          },
          {
            name: 'Outbound',
            type: 'line',
            data: byMonth.map((m: any) => m.outbound),
            itemStyle: { color: '#ef4444' },
            smooth: true,
          },
          {
            name: 'Net',
            type: 'bar',
            data: byMonth.map((m: any) => m.net),
            itemStyle: { color: '#3b82f6', opacity: 0.5 },
            barMaxWidth: 20,
          },
        ],
      }
    : null

  const valuation = data.movementAnalysis?.valuation

  return (
    <div className="space-y-4">
      {/* Opening & Closing Inventory Cards */}
      {valuation && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Opening Inventory', value: valuation.openingValue, color: 'text-blue-400' },
            { label: 'Increases', value: valuation.increaseValue, color: 'text-emerald-400' },
            { label: 'Decreases', value: valuation.decreaseValue, color: 'text-red-400' },
            { label: 'Net Movement', value: valuation.netMovement, color: valuation.netMovement >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Closing Inventory', value: valuation.closingValue, color: 'text-amber-400' },
          ].map((card) => (
            <div key={card.label} className="p-3.5 bg-white/[0.03] rounded-lg border border-white/10">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">{card.label}</p>
              <p className={`text-lg font-mono mt-1 font-semibold ${card.color}`}>
                {formatCurrency(card.value, currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Value by Category</h3>
            <ReactECharts
              option={pieOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
        {barOption && (
          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Items by Value</h3>
            <ReactECharts
              option={barOption}
              style={{ height: 300 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        )}
      </div>

      {/* Movement trend */}
      {movementOption && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Monthly Movement Trend</h3>
          <ReactECharts
            option={movementOption}
            style={{ height: 280 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )}

      {/* Turnover KPIs */}
      {data.movementAnalysis?.turnover && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.movementAnalysis.turnover).map(([key, value]) => (
            <div key={key} className="p-3.5 bg-white/[0.03] rounded-lg border border-white/10">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">{formatLabel(key)}</p>
              <p className="text-lg text-zinc-100 font-mono mt-1 font-semibold">
                {value !== null && value !== undefined
                  ? typeof value === 'number'
                    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : String(value)
                  : 'N/A'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Items table */}
      {data.items?.length > 0 && (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            Items with Stock ({data.items.length})
          </h3>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Number</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Cost</th>
                  <th className="py-2 px-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-zinc-400 font-mono text-xs">{item.number}</td>
                    <td className="py-2 px-3 text-zinc-200">{item.name}</td>
                    <td className="py-2 px-3 text-zinc-400">{item.category}</td>
                    <td className="py-2 px-3 text-right text-zinc-200 font-mono">
                      {item.inventory.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-400 font-mono">
                      {formatCurrency(item.unitCost, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-100 font-mono">
                      {formatCurrency(item.totalValue, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Markdown View ────────────────────────────────────────────────────────────

function generateMarkdownContent(data: any, connection: any): string {
  if (!data) return '_No data_'
  const lines: string[] = []
  const reportType = data.reportType
  const currency = connection?.currency || 'USD'
  const fmt = (v: number) => formatCurrency(v, currency)

  if (reportType === 'trial_balance') {
    lines.push('# Trial Balance')
    if (data.period?.startDate)
      lines.push(`**Period**: ${data.period.startDate} to ${data.period.endDate}`)
    lines.push('')
    if (data.summary) {
      lines.push('## Summary', '')
      lines.push(`- **Total Accounts**: ${data.summary.totalAccounts}`)
      lines.push(`- **Accounts with Activity**: ${data.summary.accountsWithActivity}`)
      lines.push(`- **Total Debits**: ${fmt(data.summary.totalDebits)}`)
      lines.push(`- **Total Credits**: ${fmt(data.summary.totalCredits)}`)
      lines.push(`- **Net Balance**: ${fmt(data.summary.netBalance)}`)
      lines.push(`- **Balanced**: ${data.summary.isBalanced ? 'Yes' : 'No'}`)
      lines.push('')
    }
    if (data.byCategory?.length) {
      lines.push(
        '## By Category',
        '',
        '| Category | Accounts | Debits | Credits | Net Balance |',
        '| --- | ---: | ---: | ---: | ---: |'
      )
      for (const cat of data.byCategory)
        lines.push(
          `| ${cat.category} | ${cat.count} | ${fmt(cat.totalDebits)} | ${fmt(cat.totalCredits)} | ${fmt(cat.netBalance)} |`
        )
      lines.push('')
    }
    if (data.accounts?.list?.length) {
      lines.push(
        `## Accounts (${data.accounts.list.length})`,
        '',
        '| # | Name | Category | Debit | Credit | Net Balance |',
        '| --- | --- | --- | ---: | ---: | ---: |'
      )
      for (const acc of data.accounts.list)
        lines.push(
          `| ${acc.number} | ${acc.name} | ${acc.category} | ${fmt(acc.debit)} | ${fmt(acc.credit)} | ${fmt(acc.netBalance)} |`
        )
      lines.push('')
    }
  } else if (reportType === 'profit_loss' || reportType === 'monthly_pnl_trend') {
    lines.push('# Profit & Loss Statement')
    if (data.period?.startDate)
      lines.push(`**Period**: ${data.period.startDate} to ${data.period.endDate}`)
    lines.push('')
    if (data.summary) {
      lines.push('## Summary', '', '| Metric | Amount |', '| --- | ---: |')
      lines.push(`| Revenue | ${fmt(data.summary.totalRevenue)} |`)
      lines.push(`| Cost of Goods Sold | ${fmt(data.summary.totalCOGS)} |`)
      lines.push(`| **Gross Profit** | **${fmt(data.summary.grossProfit)}** |`)
      lines.push(`| Expenses | ${fmt(data.summary.totalExpenses)} |`)
      lines.push(`| **Net Income** | **${fmt(data.summary.netIncome)}** |`)
      lines.push('')
    }
    if (data.monthlyTrend?.length) {
      lines.push(
        '## Monthly Breakdown',
        '',
        '| Month | Revenue | COGS | Gross Profit | Expenses | Net Income |',
        '| --- | ---: | ---: | ---: | ---: | ---: |'
      )
      for (const m of data.monthlyTrend)
        lines.push(
          `| ${m.month} | ${fmt(m.revenue)} | ${fmt(m.cogs)} | ${fmt(m.grossProfit)} | ${fmt(m.expenses)} | ${fmt(m.netIncome)} |`
        )
      lines.push('')
    }
    if (data.accounts?.sectionTotals?.length) {
      lines.push('## Section Totals', '', '| Category | Total |', '| --- | ---: |')
      for (const st of data.accounts.sectionTotals)
        lines.push(`| ${st.category} | ${fmt(Math.abs(st.total))} |`)
      lines.push('')
    }
    if (data.accounts?.list?.length) {
      lines.push(
        `## Accounts (${data.accounts.list.length})`,
        '',
        '| # | Name | Category | GL Amount |',
        '| --- | --- | --- | ---: |'
      )
      for (const acc of data.accounts.list)
        lines.push(`| ${acc.number} | ${acc.name} | ${acc.category} | ${fmt(acc.glAmount)} |`)
      lines.push('')
    }
  } else if (reportType === 'inventory_valuation') {
    lines.push('# Inventory Valuation')
    if (data.period?.startDate)
      lines.push(`**Period**: ${data.period.startDate} to ${data.period.endDate}`)
    lines.push('')
    if (data.summary) {
      lines.push('## Summary', '')
      lines.push(`- **Total Items**: ${data.summary.totalItems}`)
      lines.push(`- **Items with Stock**: ${data.summary.itemsWithStock}`)
      lines.push(`- **Out of Stock**: ${data.summary.outOfStock}`)
      lines.push(`- **Total Units**: ${data.summary.totalUnits?.toLocaleString()}`)
      lines.push(`- **Total Value**: ${fmt(data.summary.totalValue)}`)
      lines.push('')
    }
    if (data.byCategory?.length) {
      lines.push(
        '## By Category',
        '',
        '| Category | Items | Units | Value |',
        '| --- | ---: | ---: | ---: |'
      )
      for (const c of data.byCategory)
        lines.push(
          `| ${c.category} | ${c.count} | ${c.totalUnits.toLocaleString()} | ${fmt(c.totalValue)} |`
        )
      lines.push('')
    }
    if (data.topByValue?.length) {
      lines.push(
        '## Top Items by Value',
        '',
        '| Name | Category | Units | Unit Cost | Total Value |',
        '| --- | --- | ---: | ---: | ---: |'
      )
      for (const item of data.topByValue)
        lines.push(
          `| ${item.name} | ${item.category} | ${item.inventory} | ${fmt(item.unitCost)} | ${fmt(item.totalValue)} |`
        )
      lines.push('')
    }
    if (data.movementAnalysis?.byMonth?.length) {
      lines.push(
        '## Monthly Movement',
        '',
        '| Month | Inbound | Outbound | Net |',
        '| --- | ---: | ---: | ---: |'
      )
      for (const m of data.movementAnalysis.byMonth)
        lines.push(
          `| ${m.month} | ${m.inbound.toLocaleString()} | ${m.outbound.toLocaleString()} | ${m.net.toLocaleString()} |`
        )
      lines.push('')
    }
    if (data.movementAnalysis?.valuation) {
      const v = data.movementAnalysis.valuation
      lines.push('## Opening & Closing Inventory', '')
      lines.push('| Metric | Amount |', '| --- | ---: |')
      lines.push(`| Opening Inventory | ${fmt(v.openingValue)} |`)
      lines.push(`| Increases | ${fmt(v.increaseValue)} |`)
      lines.push(`| Decreases | ${fmt(v.decreaseValue)} |`)
      lines.push(`| Net Movement | ${fmt(v.netMovement)} |`)
      lines.push(`| **Closing Inventory** | **${fmt(v.closingValue)}** |`)
      lines.push('')
    }
    if (data.movementAnalysis?.turnover) {
      const t = data.movementAnalysis.turnover
      lines.push('## Turnover Metrics', '')
      lines.push(`- **Period**: ${t.periodDays} days`)
      lines.push(`- **Total Outbound Units**: ${t.totalOutboundUnits?.toLocaleString()}`)
      lines.push(`- **Inventory Turnover**: ${t.inventoryTurnover ?? 'N/A'}`)
      lines.push(`- **Days Inventory Outstanding**: ${t.daysInventoryOutstanding ?? 'N/A'}`)
      lines.push('')
    }
  } else if (reportType === 'aged_receivables') {
    lines.push('# Aged Receivables')
    if (data.period?.startDate)
      lines.push(`**Period**: ${data.period.startDate} to ${data.period.endDate}`)
    lines.push('')
    if (data.summary) {
      lines.push('## Summary', '')
      lines.push(`- **Total Customers**: ${data.summary.totalCustomers}`)
      lines.push(`- **Total Invoices**: ${data.summary.totalInvoices}`)
      lines.push(`- **Total Balance**: ${fmt(data.summary.totalBalance)}`)
      lines.push('')
      lines.push('## Aging Buckets', '', '| Bucket | Amount |', '| --- | ---: |')
      lines.push(`| Current | ${fmt(data.summary.current)} |`)
      lines.push(`| 1-30 Days | ${fmt(data.summary.days_1_30)} |`)
      lines.push(`| 31-60 Days | ${fmt(data.summary.days_31_60)} |`)
      lines.push(`| 61-90 Days | ${fmt(data.summary.days_61_90)} |`)
      lines.push(`| Over 90 Days | ${fmt(data.summary.days_over_90)} |`)
      lines.push('')
    }
    if (data.topCustomers?.length) {
      lines.push(
        '## Top Customers',
        '',
        '| Customer | Invoices | Balance |',
        '| --- | ---: | ---: |'
      )
      for (const c of data.topCustomers)
        lines.push(`| ${c.name} | ${c.invoiceCount} | ${fmt(c.total)} |`)
      lines.push('')
    }
    if (data.invoices?.length) {
      lines.push(
        `## Open Invoices (${data.invoices.length})`,
        '',
        '| Invoice # | Customer | Due Date | Days Past Due | Amount |',
        '| --- | --- | --- | ---: | ---: |'
      )
      for (const inv of data.invoices.slice(0, 30))
        lines.push(
          `| ${inv.invoiceNumber} | ${inv.customerName} | ${inv.dueDate} | ${inv.daysPastDue} | ${fmt(inv.amount)} |`
        )
      if (data.invoices.length > 30)
        lines.push(`\n_... and ${data.invoices.length - 30} more invoices_`)
      lines.push('')
    }
  } else if (reportType === 'aged_payables') {
    lines.push('# Aged Payables')
    if (data.period?.startDate)
      lines.push(`**Period**: ${data.period.startDate} to ${data.period.endDate}`)
    lines.push('')
    if (data.summary) {
      lines.push('## Summary', '')
      lines.push(`- **Total Vendors**: ${data.summary.totalVendors}`)
      lines.push(`- **Total Invoices**: ${data.summary.totalInvoices}`)
      lines.push(`- **Total Balance**: ${fmt(data.summary.totalBalance)}`)
      lines.push('')
      lines.push('## Aging Buckets', '', '| Bucket | Amount |', '| --- | ---: |')
      lines.push(`| Current | ${fmt(data.summary.current)} |`)
      lines.push(`| 1-30 Days | ${fmt(data.summary.days_1_30)} |`)
      lines.push(`| 31-60 Days | ${fmt(data.summary.days_31_60)} |`)
      lines.push(`| 61-90 Days | ${fmt(data.summary.days_61_90)} |`)
      lines.push(`| Over 90 Days | ${fmt(data.summary.days_over_90)} |`)
      lines.push('')
    }
    if (data.topVendors?.length) {
      lines.push('## Top Vendors', '', '| Vendor | Invoices | Balance |', '| --- | ---: | ---: |')
      for (const v of data.topVendors)
        lines.push(`| ${v.name} | ${v.invoiceCount} | ${fmt(v.total)} |`)
      lines.push('')
    }
    if (data.invoices?.length) {
      lines.push(
        `## Open Invoices (${data.invoices.length})`,
        '',
        '| Invoice # | Vendor | Due Date | Days Past Due | Amount |',
        '| --- | --- | --- | ---: | ---: |'
      )
      for (const inv of data.invoices.slice(0, 30))
        lines.push(
          `| ${inv.invoiceNumber} | ${inv.vendorName} | ${inv.dueDate} | ${inv.daysPastDue} | ${fmt(inv.amount)} |`
        )
      if (data.invoices.length > 30)
        lines.push(`\n_... and ${data.invoices.length - 30} more invoices_`)
      lines.push('')
    }
  } else {
    lines.push(`# ${formatLabel(reportType || 'Report')} Data`, '')
    if (data.summary) {
      lines.push('## Summary', '', '| Key | Value |', '| --- | ---: |')
      for (const [k, v] of Object.entries(data.summary)) {
        lines.push(
          `| ${formatLabel(k)} | ${typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)} |`
        )
      }
      lines.push('')
    }
    if (data.data?.length) {
      const sample = data.data[0]
      const keys = Object.keys(sample).slice(0, 6)
      lines.push(`## Data (${data.data.length} rows)`, '')
      lines.push('| ' + keys.map(formatLabel).join(' | ') + ' |')
      lines.push('| ' + keys.map(() => '---').join(' | ') + ' |')
      for (const row of data.data.slice(0, 20)) {
        lines.push('| ' + keys.map((k) => String(row[k] ?? '')).join(' | ') + ' |')
      }
      if (data.data.length > 20) lines.push(`\n_... and ${data.data.length - 20} more rows_`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function ResultMarkdownView({ result }: { result: TestResult }) {
  const markdown = useMemo(
    () => generateMarkdownContent(result.result, result.connection),
    [result]
  )

  return (
    <div
      className="mt-4 rounded-lg border border-blue-500/20 bg-white/[0.02] p-5
      prose prose-invert prose-sm max-w-none
      prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:px-3 prose-th:py-2 prose-th:bg-white/[0.05] prose-th:text-left
      prose-td:border prose-td:border-white/10 prose-td:px-3 prose-td:py-1.5
      prose-headings:text-zinc-100 prose-p:text-zinc-300
      prose-strong:text-zinc-100 prose-li:text-zinc-300 prose-li:marker:text-zinc-500"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  )
}

// ── Reusable form components ─────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  emptyLabel?: string
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === '' ? emptyLabel || '—' : formatLabel(opt)}
          </option>
        ))}
      </select>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      />
    </div>
  )
}
