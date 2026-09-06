'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { InfoTooltipBody } from '@/components/ui/InfoTooltipBody'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyCustomers } from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { ReactECharts, useThemeEChartsConfig } from '@/components/chat/visualizations/shared'
import { cn } from '@/lib/utils'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyCustomer, ShopifyGraphQLCustomerNode } from '@/lib/providers/shopify/types'
import { CustomerDetailPanel } from './CustomerDetailPanel'
import {
  Mail,
  MessageSquare,
  Star,
  UserPlus,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

const ROW_HEIGHT = 44
const EXPANDED_HEIGHT = 400

function StatCard({
  label,
  tooltip,
  children,
}: {
  label: string
  tooltip: Pick<InfoTooltipProps, 'description' | 'calculationTooltip' | 'note'>
  children: React.ReactNode
}) {
  const content = (
    <div className="group/stat">
      <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 decoration-current/15 underline-offset-2 group-hover/stat:underline">
        {label}
      </div>
      {children}
    </div>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="kpi-tooltip text-xs rounded-lg shadow-xl border z-[100] w-72 p-3 max-w-none"
        >
          <InfoTooltipBody {...tooltip} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function formatDate(dateStr: string, timeZone?: string) {
  const date = new Date(dateStr)
  const tzOpts = timeZone ? { timeZone } : {}
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, ...tzOpts })
    .toLowerCase()
  const month = date.toLocaleDateString('en-US', { month: 'short', ...tzOpts })
  const day = parseInt(date.toLocaleDateString('en-US', { day: 'numeric', ...tzOpts }), 10)

  if (date.getFullYear() === new Date().getFullYear()) {
    return `${month} ${day} at ${time}`
  }
  return `${month} ${day}, ${date.getFullYear()} at ${time}`
}

function CustomerTierBadge({
  customer,
  avgSpend,
}: {
  customer: ShopifyCustomer
  avgSpend: number
}) {
  const spent = parseFloat(customer.total_spent || '0')
  const orders = customer.orders_count || 0

  if (orders === 0) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        New
      </span>
    )
  }
  if (spent >= avgSpend * 3) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
        VIP
      </span>
    )
  }
  if (orders > 1) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Returning
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      Regular
    </span>
  )
}

export default function ShopifyCustomersPage() {
  const { connected, isLoading: connLoading } = useShopifyConnection()

  const {
    selectedPeriod,
    setSelectedPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useShopifyDateRange()

  const { data, isLoading, error, mutate } = useShopifyCustomers(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const { tooltipStyle, axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()
  const sectionHover = cn(
    'group relative rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.01] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
  )
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string>('total_spent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null)
  const [riskExpanded, setRiskExpanded] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const riskRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!riskExpanded) return
    const handler = (e: MouseEvent) => {
      if (riskRef.current && !riskRef.current.contains(e.target as Node)) {
        setRiskExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [riskExpanded])

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const handleSort = (col: string) => {
    if (sortKey === col) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col)
      setSortDir(col === 'name' || col === 'email' || col === 'location' ? 'asc' : 'desc')
    }
  }

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">
          No Shopify connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  const customers = data?.customers ?? []
  const summary = data?.summary
  const atRiskCustomers = summary?.atRiskCustomers ?? []
  const cur = summary?.currency ?? 'USD'
  const warning = data?.warning
  const graphqlWarning = data?.graphqlWarning
  const acquisitionTrend = data?.acquisitionTrend ?? []
  const storeTimezone = data?.storeTimezone
  const vipCustomers = data?.vipCustomers ?? []
  const mostOrdered = data?.mostOrdered ?? []
  const retentionCohorts = data?.retentionCohorts ?? []

  // Chart options — use centralized theme config
  const acquisitionChartOption = {
    tooltip: { trigger: 'axis', ...tooltipStyle },
    grid: { top: 20, right: 60, bottom: 24, left: 60 },
    xAxis: {
      type: 'category',
      data: acquisitionTrend.map((d: { date: string }) => d.date),
      axisLine: { lineStyle: splitLineStyle },
      axisLabel: axisLabelStyle,
    },
    yAxis: [
      {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: splitLineStyle },
        axisLabel: axisLabelStyle,
      },
      {
        type: 'value',
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCurrency(v, cur) },
      },
    ],
    series: [
      {
        name: 'New Customers',
        type: 'bar',
        data: acquisitionTrend.map((d: { newCustomers: number }) => d.newCustomers),
        barMaxWidth: 24,
        itemStyle: {
          borderRadius: 0,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.7)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.25)' },
            ],
          },
        },
      },
      {
        name: 'Total Spent',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: acquisitionTrend.map((d: { totalSpent: number }) => d.totalSpent),
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: '#10b981' },
        lineStyle: { color: '#10b981' },
      },
    ],
  }

  // Build GraphQL lookup for enrichment
  const graphqlMap = new Map<string, ShopifyGraphQLCustomerNode>()
  if (data?.graphqlCustomers) {
    for (const gc of data.graphqlCustomers) {
      if (gc.email) graphqlMap.set(gc.email, gc)
    }
  }

  const filtered = customers
    .filter(
      (c: ShopifyCustomer) =>
        !search ||
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a: ShopifyCustomer, b: ShopifyCustomer) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'name': {
          const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
          const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
          return dir * aName.localeCompare(bName)
        }
        case 'email': {
          const aEmail = (a.email || '').toLowerCase()
          const bEmail = (b.email || '').toLowerCase()
          return dir * aEmail.localeCompare(bEmail)
        }
        case 'orders_count':
          return dir * ((a.orders_count || 0) - (b.orders_count || 0))
        case 'total_spent':
          return dir * (parseFloat(a.total_spent || '0') - parseFloat(b.total_spent || '0'))
        case 'location': {
          const aLoc = a.default_address
            ? `${a.default_address.city || ''} ${a.default_address.country || ''}`
                .trim()
                .toLowerCase()
            : ''
          const bLoc = b.default_address
            ? `${b.default_address.city || ''} ${b.default_address.country || ''}`
                .trim()
                .toLowerCase()
            : ''
          return dir * aLoc.localeCompare(bLoc)
        }
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        case 'updated_at':
          return dir * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        default:
          return 0
      }
    })

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const customer = filtered[index]
        return expandedCustomer === customer?.id ? ROW_HEIGHT + EXPANDED_HEIGHT : ROW_HEIGHT
      },
      [filtered, expandedCustomer]
    ),
    overscan: 10,
  })

  return (
    <div className="@container space-y-10 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Customers
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodPicker
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onCustomEndDateChange={setCustomEndDate}
              disabled={isLoading}
            />
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-sm text-red-500">Failed to load customers. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {warning && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{warning}</p>
            </div>
          )}

          {graphqlWarning && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">{graphqlWarning}</p>
            </div>
          )}

          {/* Summary metric strip */}
          {summary && (
            <div
              className={cn(
                'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
                borderClass
              )}
            >
              <StatCard
                label="Total Customers"
                tooltip={{
                  description:
                    'All customers in your Shopify store, including those with zero orders.',
                }}
              >
                <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                  {summary.totalCount}
                </div>
              </StatCard>
              <StatCard
                label="With Orders"
                tooltip={{
                  description: 'Customers who have placed at least one order.',
                  calculationTooltip: {
                    formula: 'Count where orders_count ≥ 1',
                    components: [
                      {
                        label: 'With Orders',
                        value: String(summary.withOrdersCount),
                        highlight: true,
                      },
                    ],
                  },
                }}
              >
                <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                  {summary.withOrdersCount}
                </div>
              </StatCard>
              <StatCard
                label="Total Spent"
                tooltip={{
                  description: 'Cumulative lifetime spend across all customers.',
                  calculationTooltip: {
                    formula: 'Σ total_spent for all customers',
                    components: [
                      {
                        label: 'Total Spent',
                        value: formatCurrency(summary.totalSpent, cur),
                        highlight: true,
                      },
                    ],
                  },
                }}
              >
                <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                  {formatCurrency(summary.totalSpent, cur)}
                </div>
              </StatCard>
              <StatCard
                label="Avg Spend"
                tooltip={{
                  description: 'Average lifetime spend per customer.',
                  calculationTooltip: {
                    formula: 'Total Spent ÷ Total Customers',
                    components: [
                      { label: 'Total Spent', value: formatCurrency(summary.totalSpent, cur) },
                      { label: '÷ Customers', value: String(summary.totalCount) },
                      {
                        label: '= Avg Spend',
                        value: formatCurrency(summary.avgSpent, cur),
                        highlight: true,
                      },
                    ],
                  },
                }}
              >
                <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                  {formatCurrency(summary.avgSpent, cur)}
                </div>
              </StatCard>
            </div>
          )}

          {/* Extended stats metric strip */}
          {summary && (summary.returningRate != null || summary.emailSubscribers != null) && (
            <div
              className={cn(
                'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
                borderClass
              )}
            >
              {summary.returningRate != null && (
                <StatCard
                  label="Returning Rate"
                  tooltip={{
                    description: 'Percentage of customers who have placed more than one order.',
                    calculationTooltip: {
                      formula: '(Customers with orders > 1 ÷ Total Customers) × 100',
                      components: [
                        {
                          label: 'Returning Rate',
                          value: `${(summary.returningRate ?? 0).toFixed(1)}%`,
                          highlight: true,
                        },
                      ],
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.returningRate.toFixed(1)}%
                  </div>
                </StatCard>
              )}
              {summary.emailSubscribers != null && (
                <StatCard
                  label="Email Subscribers"
                  tooltip={{
                    description: 'Customers who have opted in to email marketing.',
                    calculationTooltip: {
                      formula: 'Count where email_marketing_consent = subscribed',
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.emailSubscribers}
                  </div>
                </StatCard>
              )}
              {summary.topSpenders != null && (
                <StatCard
                  label="Top Spenders"
                  tooltip={{
                    description: 'Customers in the top 10% by lifetime spend.',
                    calculationTooltip: { formula: 'Top 10th percentile of total_spent' },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.topSpenders}
                  </div>
                </StatCard>
              )}
              {summary.newLast30d != null && (
                <StatCard
                  label="New (30 days)"
                  tooltip={{
                    description: 'Customers created in the last 30 days.',
                    calculationTooltip: { formula: 'Count where created_at ≥ today − 30 days' },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.newLast30d}
                  </div>
                </StatCard>
              )}
              {summary.repeatPurchaseRate != null && (
                <StatCard
                  label="Repeat Purchase Rate"
                  tooltip={{
                    description:
                      'Percentage of customers with orders who have purchased more than once.',
                    calculationTooltip: {
                      formula: '(Customers with 2+ orders ÷ Customers with 1+ orders) × 100',
                      components: [
                        {
                          label: 'Repeat Rate',
                          value: `${summary.repeatPurchaseRate}%`,
                          highlight: true,
                        },
                        ...(summary.avgOrderFrequency != null
                          ? [
                              {
                                label: 'Avg Order Frequency',
                                value: `${summary.avgOrderFrequency} orders/customer`,
                              },
                            ]
                          : []),
                      ],
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.repeatPurchaseRate}%
                  </div>
                  {summary.avgOrderFrequency != null && (
                    <div className="text-xs text-stone-500">
                      {summary.avgOrderFrequency} orders/customer avg
                    </div>
                  )}
                </StatCard>
              )}
              {summary.avgDaysBetweenOrders != null && (
                <StatCard
                  label="Avg Days Between Orders"
                  tooltip={{
                    description:
                      'Average number of days between consecutive orders for repeat customers.',
                    calculationTooltip: {
                      formula: 'Avg(order[n+1].date − order[n].date) for repeat customers',
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.avgDaysBetweenOrders}
                    <span className="text-[16px] text-stone-500 font-normal ml-1">days</span>
                  </div>
                </StatCard>
              )}
              {summary.predictedHighTier != null && (
                <StatCard
                  label="Predicted High Tier"
                  tooltip={{
                    description:
                      "Customers Shopify's machine learning model predicts will be in the highest lifetime spend tier. Surfaced from Customer.statistics.predictedSpendTier — a free signal computed by Shopify and updated automatically.",
                    calculationTooltip: {
                      formula: 'Count where statistics.predictedSpendTier = HIGH',
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {summary.predictedHighTier}
                  </div>
                </StatCard>
              )}
              {summary.totalStoreCredit != null && summary.totalStoreCredit > 0 && (
                <StatCard
                  label="Store Credit Outstanding"
                  tooltip={{
                    description:
                      'Total balance of all customer store credit accounts. This is a liability sitting on your books — money customers can spend on future orders.',
                    calculationTooltip: {
                      formula: 'Σ storeCreditAccounts.balance for every customer',
                      components: [
                        {
                          label: 'Customers with credit',
                          value: String(summary.customersWithStoreCredit ?? 0),
                        },
                        {
                          label: 'Total liability',
                          value: formatCurrency(summary.totalStoreCredit, cur),
                          highlight: true,
                        },
                      ],
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {formatCurrency(summary.totalStoreCredit, cur)}
                  </div>
                  {summary.customersWithStoreCredit != null && (
                    <div className="text-xs text-stone-500">
                      {summary.customersWithStoreCredit} customer
                      {summary.customersWithStoreCredit !== 1 ? 's' : ''}
                    </div>
                  )}
                </StatCard>
              )}
            </div>
          )}

          {/* At-Risk Alert */}
          {summary && summary.atRisk != null && summary.atRisk > 0 && (
            <div className="relative" ref={riskRef}>
              <button
                onClick={() => setRiskExpanded(!riskExpanded)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-[4px] border transition-colors',
                  'border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20',
                  'hover:bg-orange-100 dark:hover:bg-orange-900/30'
                )}
              >
                <AlertCircle className="w-3.5 h-3.5 text-orange-500/80" />
                <span
                  className={cn(
                    'text-xs font-medium uppercase tracking-wider',
                    isLight ? 'text-orange-600' : 'text-orange-400'
                  )}
                >
                  {summary.atRisk} customers at risk — no orders in 90+ days
                </span>
                <ChevronDown
                  className={cn(
                    'w-3 h-3 text-orange-400 transition-transform',
                    riskExpanded && 'rotate-180'
                  )}
                />
              </button>
              {riskExpanded && atRiskCustomers.length > 0 && (
                <div
                  className={cn(
                    'absolute top-full left-0 mt-2 z-20 w-[460px] rounded-[4px] border shadow-lg overflow-hidden',
                    borderClass,
                    'bg-[var(--theme-bg)]'
                  )}
                >
                  <div
                    className={cn(
                      'px-3 py-2 border-b',
                      'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30'
                    )}
                  >
                    <div className="text-xs font-medium uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      At-Risk Customers
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      These customers have placed orders before but haven&apos;t purchased in over
                      90 days. They may be churning — consider a win-back campaign or personalized
                      outreach.
                    </p>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {atRiskCustomers.map((rc) => (
                      <div
                        key={rc.email || rc.name}
                        onClick={() => {
                          const match = customers.find(
                            (c) =>
                              c.email === rc.email ||
                              `${c.first_name || ''} ${c.last_name || ''}`.trim() === rc.name
                          )
                          if (match) {
                            setExpandedCustomer(match.id)
                            setRiskExpanded(false)
                            const idx = filtered.findIndex((c) => c.id === match.id)
                            if (idx >= 0) {
                              requestAnimationFrame(() => {
                                rowVirtualizer.scrollToIndex(idx, {
                                  align: 'center',
                                  behavior: 'smooth',
                                })
                              })
                            }
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 cursor-pointer',
                          isLight
                            ? 'border-stone-100 hover:bg-black/[0.03]'
                            : 'border-white/[0.05] hover:bg-white/[0.03]'
                        )}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium theme-text-primary">{rc.name}</span>
                          <span className="text-xs text-stone-500 truncate">
                            Last order{' '}
                            {new Date(rc.lastOrderDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            &middot; {rc.orderCount} order{rc.orderCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'font-mono text-sm font-semibold tabular-nums ml-3 flex-shrink-0',
                            'theme-text-primary'
                          )}
                        >
                          {formatCurrency(rc.totalSpent, rc.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NEW VS RETURNING ── */}
          {summary && summary.withOrdersCount > 0 && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  New vs Returning
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-8')}>
                {/* Donut chart */}
                <section
                  className={cn(
                    'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                    isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                    sectionHover
                  )}
                >
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-4 flex items-center gap-2">
                    Customer Split
                    <InfoTooltip description="Breakdown of customers with orders: new (single purchase) vs returning (2+ purchases)." />
                  </p>
                  {(() => {
                    const returningCount = Math.round(
                      ((summary.returningRate ?? 0) * summary.withOrdersCount) / 100
                    )
                    const newCount = summary.withOrdersCount - returningCount
                    return (
                      <ReactECharts
                        option={{
                          tooltip: {
                            trigger: 'item',
                            ...tooltipStyle,
                            formatter: (p: any) =>
                              `${p.name}<br/>${p.value} customers (${p.percent}%)`,
                          },
                          series: [
                            {
                              type: 'pie',
                              radius: ['45%', '72%'],
                              center: ['50%', '55%'],
                              avoidLabelOverlap: true,
                              itemStyle: {
                                borderRadius: 0,
                                borderColor: isLight ? '#faf8f5' : '#121212',
                                borderWidth: 2,
                              },
                              label: { ...axisLabelStyle },
                              data: [
                                {
                                  name: 'New (1 order)',
                                  value: newCount,
                                  itemStyle: { color: '#3b82f6' },
                                },
                                {
                                  name: 'Returning (2+)',
                                  value: returningCount,
                                  itemStyle: { color: '#10b981' },
                                },
                              ],
                            },
                          ],
                        }}
                        style={{ width: '100%', height: 260 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    )
                  })()}
                </section>

                {/* Summary cards */}
                <section className={sectionHover}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-4">
                    Breakdown
                  </p>
                  <div className="space-y-4">
                    {(() => {
                      const returningCount = Math.round(
                        ((summary.returningRate ?? 0) * summary.withOrdersCount) / 100
                      )
                      const newCount = summary.withOrdersCount - returningCount
                      const noOrders = summary.totalCount - summary.withOrdersCount
                      const items = [
                        {
                          label: 'New Customers',
                          desc: 'Single purchase only',
                          value: newCount,
                          color: '#3b82f6',
                          icon: <UserPlus className="w-4 h-4" />,
                        },
                        {
                          label: 'Returning Customers',
                          desc: '2+ purchases',
                          value: returningCount,
                          color: '#10b981',
                          icon: <TrendingUp className="w-4 h-4" />,
                        },
                        {
                          label: 'No Orders',
                          desc: 'Accounts with no purchases',
                          value: noOrders,
                          color: isLight ? '#a8a29e' : '#78716c',
                          icon: <AlertCircle className="w-4 h-4" />,
                        },
                      ]
                      return items.map(({ label, desc, value, color, icon }) => (
                        <div
                          key={label}
                          className={cn(
                            'flex items-center gap-4 px-4 py-3 rounded-lg border',
                            isLight
                              ? 'border-stone-200 bg-stone-50'
                              : 'border-white/[0.06] bg-white/[0.02]'
                          )}
                        >
                          <div className="flex-shrink-0" style={{ color }}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                'text-sm font-medium',
                                isLight ? 'text-stone-900' : 'text-white'
                              )}
                            >
                              {label}
                            </div>
                            <div className="text-xs theme-text-secondary">{desc}</div>
                          </div>
                          <div
                            className={cn(
                              'text-xl font-mono font-semibold tabular-nums',
                              isLight ? 'text-stone-900' : 'text-white'
                            )}
                          >
                            {value.toLocaleString()}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ── CUSTOMER ANALYTICS ── */}
          {acquisitionTrend.length > 0 && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Customer Analytics
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <section className={cn('max-w-4xl', sectionHover)}>
                <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6">
                  Customer Acquisition Over Time
                </p>
                <ReactECharts
                  option={acquisitionChartOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </section>
            </div>
          )}

          {/* ── VIP & PRODUCTS ── */}
          {(vipCustomers.length > 0 || mostOrdered.length > 0) && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Top Performers
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-16')}>
                {/* Top Spenders */}
                {vipCustomers.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-4 flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-purple-500" />
                      VIP Customers
                      <InfoTooltip description="Customers who have spent more than 2× the average customer spend. Sorted by total lifetime spend." />
                    </p>
                    <div className="space-y-0 max-h-[360px] overflow-y-auto styled-scrollbar">
                      {vipCustomers.map((vip, i) => (
                        <div
                          key={vip.email || i}
                          className={cn(
                            'flex items-center justify-between py-2 px-2 text-sm',
                            i % 2 === 0 ? (isLight ? 'bg-black/[0.015]' : 'bg-white/[0.015]') : '',
                            i < vipCustomers.length - 1 && 'border-b',
                            isLight ? 'border-stone-100/60' : 'border-white/[0.03]'
                          )}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-stone-400 w-4">
                                #{i + 1}
                              </span>
                              <span className={cn('font-medium truncate', 'theme-text-primary')}>
                                {vip.name}
                              </span>
                            </div>
                            <span className="text-xs text-stone-500 ml-6">
                              {vip.ordersCount} order{vip.ordersCount !== 1 ? 's' : ''} · AOV{' '}
                              {formatCurrency(vip.avgOrderValue, vip.currency)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'font-mono text-sm font-semibold tabular-nums ml-3 flex-shrink-0',
                              'theme-text-primary'
                            )}
                          >
                            {formatCurrency(vip.totalSpent, vip.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Most Ordered Products */}
                {mostOrdered.length > 0 && (
                  <section className={cn('flex flex-col', sectionHover)}>
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-4 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      Most Ordered Products
                      <InfoTooltip description="Products ordered most frequently across all customers in the selected period." />
                    </p>
                    <div className="space-y-0 max-h-[360px] overflow-y-auto styled-scrollbar">
                      {mostOrdered.map((item, i) => (
                        <div
                          key={item.productTitle}
                          className={cn(
                            'flex items-center justify-between py-2 px-2 text-sm',
                            i % 2 === 0 ? (isLight ? 'bg-black/[0.015]' : 'bg-white/[0.015]') : '',
                            i < mostOrdered.length - 1 && 'border-b',
                            isLight ? 'border-stone-100/60' : 'border-white/[0.03]'
                          )}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-stone-400 w-4">
                                #{i + 1}
                              </span>
                              <span className={cn('font-medium truncate', 'theme-text-primary')}>
                                {item.productTitle}
                              </span>
                            </div>
                            <span className="text-xs text-stone-500 ml-6">
                              {item.uniqueCustomers} unique customer
                              {item.uniqueCustomers !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'font-mono text-sm font-semibold tabular-nums ml-3 flex-shrink-0',
                              'theme-text-primary'
                            )}
                          >
                            {item.totalOrdered.toLocaleString()} units
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* ── RETENTION ── */}
          {retentionCohorts.length > 0 && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Retention
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <section className={cn('max-w-4xl', sectionHover)}>
                <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6 flex items-center gap-2">
                  Retention by Cohort
                  <InfoTooltip description="Customer retention rates by first-purchase month. Shows percentage of customers in each cohort who made a repeat purchase within 30, 60, and 90 days." />
                </p>
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'axis', ...tooltipStyle },
                    legend: { textStyle: { ...axisLabelStyle }, top: 0, right: 0 },
                    grid: { top: 24, right: 16, bottom: 24, left: 50 },
                    xAxis: {
                      type: 'category',
                      data: retentionCohorts.map((c) => {
                        const [y, m] = c.cohortMonth.split('-')
                        return new Date(
                          Date.UTC(parseInt(y), parseInt(m) - 1, 1)
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          year: '2-digit',
                          timeZone: 'UTC',
                        })
                      }),
                      axisLine: { lineStyle: splitLineStyle },
                      axisLabel: axisLabelStyle,
                    },
                    yAxis: {
                      type: 'value',
                      axisLine: { show: false },
                      splitLine: { lineStyle: splitLineStyle },
                      axisLabel: { ...axisLabelStyle, formatter: (v: number) => `${v}%` },
                    },
                    series: [
                      {
                        name: '30-day',
                        type: 'bar',
                        data: retentionCohorts.map((c) => c.retainedAt30d),
                        barMaxWidth: 16,
                        itemStyle: { color: '#3b82f6', borderRadius: 0 },
                      },
                      {
                        name: '60-day',
                        type: 'bar',
                        data: retentionCohorts.map((c) => c.retainedAt60d),
                        barMaxWidth: 16,
                        itemStyle: { color: '#8b5cf6', borderRadius: 0 },
                      },
                      {
                        name: '90-day',
                        type: 'bar',
                        data: retentionCohorts.map((c) => c.retainedAt90d),
                        barMaxWidth: 16,
                        itemStyle: { color: '#10b981', borderRadius: 0 },
                      },
                    ],
                  }}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </section>
            </div>
          )}

          {/* ── CUSTOMER LIST ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Customer List
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Search */}
            <div className="relative max-w-sm mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full h-9 pl-9 pr-3 rounded-[4px] text-sm focus:outline-none transition-colors',
                  'border bg-transparent theme-text-primary',
                  borderClass,
                  'placeholder:text-stone-400',
                  'focus:border-amber-500/40'
                )}
              />
            </div>

            {filtered.some((c) => !`${c.first_name || ''} ${c.last_name || ''}`.trim()) && (
              <p className="text-xs theme-text-secondary italic mb-4">
                Customers without a name are shown by their email address.
              </p>
            )}

            {/* Customers table (virtualized) */}
            <div className={cn('rounded-[4px] border', borderClass)}>
              {/* Sticky header */}
              <div
                className={cn(
                  'grid grid-cols-[minmax(150px,2fr)_60px_minmax(140px,2fr)_minmax(100px,1.2fr)_60px_70px_minmax(140px,1.5fr)_minmax(150px,1.5fr)_90px_minmax(130px,1.3fr)] items-center gap-x-4 px-4 py-3 text-sm font-medium text-stone-500 border-b',
                  borderClass,
                  'bg-[var(--theme-bg)]'
                )}
              >
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none"
                >
                  Customer <SortIcon col="name" />
                </button>
                <div className="justify-self-center">Tier</div>
                <button
                  onClick={() => handleSort('email')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none"
                >
                  Email <SortIcon col="email" />
                </button>
                <button
                  onClick={() => handleSort('location')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none"
                >
                  Location <SortIcon col="location" />
                </button>
                <button
                  onClick={() => handleSort('orders_count')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none"
                >
                  Orders <SortIcon col="orders_count" />
                </button>
                <div className="justify-self-center">Marketing</div>
                <button
                  onClick={() => handleSort('created_at')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none text-center"
                >
                  Customer added date <SortIcon col="created_at" />
                </button>
                <button
                  onClick={() => handleSort('updated_at')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none text-center"
                >
                  Date customer updated <SortIcon col="updated_at" />
                </button>
                <button
                  onClick={() => handleSort('total_spent')}
                  className="flex items-center justify-self-center gap-1 cursor-pointer select-none"
                >
                  Total Spent <SortIcon col="total_spent" />
                </button>
                <div className="justify-self-center">Last Order</div>
              </div>

              {/* Virtualized rows */}
              <div
                ref={parentRef}
                className="overflow-auto styled-scrollbar"
                style={{
                  height: Math.min(
                    filtered.length * ROW_HEIGHT + (expandedCustomer != null ? EXPANDED_HEIGHT : 0),
                    900
                  ),
                  contain: 'strict',
                }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const customer = filtered[virtualRow.index]
                    const isExpanded = expandedCustomer === customer.id
                    return (
                      <div
                        key={customer.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className="absolute left-0 right-0"
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {/* Row */}
                        <div
                          onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                          className={cn(
                            'grid grid-cols-[minmax(150px,2fr)_60px_minmax(140px,2fr)_minmax(100px,1.2fr)_60px_70px_minmax(140px,1.5fr)_minmax(150px,1.5fr)_90px_minmax(130px,1.3fr)] gap-x-4 px-4 items-center text-sm cursor-pointer transition-colors duration-150',
                            virtualRow.index % 2 === 0
                              ? isLight
                                ? 'bg-black/[0.015]'
                                : 'bg-white/[0.015]'
                              : '',
                            isLight ? 'hover:bg-black/[0.03]' : 'hover:bg-white/[0.03]',
                            isExpanded && (isLight ? 'bg-black/[0.03]' : 'bg-white/[0.03]')
                          )}
                          style={{ height: ROW_HEIGHT }}
                        >
                          <div className={cn('font-medium truncate', 'theme-text-primary')}>
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                              )}
                              <span className="truncate">
                                {`${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
                                  customer.email ||
                                  'Unknown'}
                              </span>
                            </div>
                          </div>
                          <div className="justify-self-center">
                            {(() => {
                              const gc = graphqlMap.get(customer.email || '')
                              const predicted = gc?.statistics?.predictedSpendTier
                              return (
                                <div className="flex items-center gap-1">
                                  <CustomerTierBadge
                                    customer={customer}
                                    avgSpend={summary?.avgSpent ?? 0}
                                  />
                                  {predicted && (
                                    <TooltipProvider delayDuration={0}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={cn(
                                              'inline-flex items-center px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded',
                                              predicted === 'HIGH'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : predicted === 'MEDIUM'
                                                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                                                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                                            )}
                                          >
                                            ML
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="text-xs px-2 py-1 rounded shadow-lg border z-[100] bg-[var(--theme-bg)]"
                                        >
                                          <div className="font-medium">
                                            Predicted spend tier: {predicted}
                                          </div>
                                          {gc?.statistics?.rfmGroup && (
                                            <div className="text-stone-500">
                                              RFM group: {gc.statistics.rfmGroup}
                                            </div>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                          <div className="text-stone-500 truncate">{customer.email || '-'}</div>
                          <div className="text-stone-500 text-center truncate">
                            {customer.default_address
                              ? `${customer.default_address.city || ''}${customer.default_address.city && customer.default_address.country ? ', ' : ''}${customer.default_address.country || ''}`
                              : '-'}
                          </div>
                          <div
                            className={cn(
                              'text-center font-mono tabular-nums',
                              'theme-text-primary'
                            )}
                          >
                            {customer.orders_count || 0}
                          </div>
                          <div className="text-center">
                            {(() => {
                              const gc = graphqlMap.get(customer.email || '')
                              if (!gc) return <span className="text-xs text-stone-500">-</span>
                              return (
                                <div className="flex items-center justify-center gap-1.5">
                                  {gc.emailMarketingConsent?.marketingState === 'SUBSCRIBED' && (
                                    <Mail className="w-3.5 h-3.5 text-green-500" />
                                  )}
                                  {gc.smsMarketingConsent?.marketingState === 'SUBSCRIBED' && (
                                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                  )}
                                  {gc.emailMarketingConsent?.marketingState !== 'SUBSCRIBED' &&
                                    gc.smsMarketingConsent?.marketingState !== 'SUBSCRIBED' && (
                                      <span className="text-xs text-stone-500">None</span>
                                    )}
                                </div>
                              )
                            })()}
                          </div>
                          <div className="text-stone-500 text-center truncate">
                            {customer.created_at
                              ? formatDate(customer.created_at, storeTimezone)
                              : '-'}
                          </div>
                          <div className="text-stone-500 text-center truncate">
                            {customer.updated_at
                              ? formatDate(customer.updated_at, storeTimezone)
                              : '-'}
                          </div>
                          <div
                            className={cn(
                              'text-center font-mono font-medium tabular-nums',
                              'theme-text-primary'
                            )}
                          >
                            {formatCurrency(customer.total_spent || 0, cur)}
                          </div>
                          <div className="text-stone-500 text-center truncate">
                            {(() => {
                              const gc = graphqlMap.get(customer.email || '')
                              if (gc?.lastOrder?.createdAt)
                                return formatDate(gc.lastOrder.createdAt, storeTimezone)
                              return customer.last_order_id
                                ? formatDate(customer.updated_at, storeTimezone)
                                : '-'
                            })()}
                          </div>
                        </div>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <CustomerDetailPanel
                            customerId={customer.id}
                            isLight={isLight}
                            onClose={() => setExpandedCustomer(null)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center theme-text-secondary text-sm">
                  No customers found.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
