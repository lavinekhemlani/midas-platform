'use client'

import { useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import {
  useShopifyMarketing,
  useShopifyCustomerJourneys,
  useShopifyHeatmapSessions,
} from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyMarketingChannelRow } from '@/lib/providers/shopify/types'
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Users,
  UserPlus,
  UserCheck,
  Route,
  Clock,
  MousePointerClick,
  Calendar,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { KPIStrip } from '@/app/(main)/shopify/components/KPIStrip'

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function TypeBadge({ type, isLight }: { type: string; isLight: boolean }) {
  const colors: Record<string, string> = {
    direct: cn(isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-400'),
    paid: cn(isLight ? 'bg-orange-50 text-orange-700' : 'bg-orange-900/20 text-orange-400'),
    organic: cn(isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-900/20 text-emerald-400'),
    social: cn(isLight ? 'bg-purple-50 text-purple-700' : 'bg-purple-900/20 text-purple-400'),
    unknown: cn(isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'),
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium capitalize',
        colors[type] || colors.unknown
      )}
    >
      {type}
    </span>
  )
}

// Channel family grouping — maps sub-channels to their parent group
// Only group channels that Shopify groups together (same ad platform)
const CHANNEL_FAMILIES: Record<string, string[]> = {
  Google: ['google', 'youtube', 'unattributed', 'gmail'],
}

// Display names for known channels
const DISPLAY_NAMES: Record<string, string> = {
  direct: 'Direct',
  google: 'Google Search',
  youtube: 'YouTube',
  gmail: 'Gmail',
  doubleclick: 'Doubleclick',
  googlesyndication: 'Google Syndication',
  facebook: 'Facebook',
  instagram: 'Instagram',
  unattributed: 'Unattributed',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  reddit: 'Reddit',
  shop_app: 'Shop App',
  shopify: 'Shopify',
  shopify_email: 'Shopify Email',
}

function getDisplayName(channel: string): string {
  return DISPLAY_NAMES[channel.toLowerCase()] || channel.charAt(0).toUpperCase() + channel.slice(1)
}

// Reverse lookup: channel → parent family name (or null if standalone)
function getFamily(channel: string): string | null {
  const lc = channel.toLowerCase()
  for (const [family, members] of Object.entries(CHANNEL_FAMILIES)) {
    if (members.includes(lc)) return family
  }
  return null
}

interface ChannelGroup {
  family: string
  type: string
  sessions: number
  totalSales: number
  orders: number
  conversionRate: number
  adSpend: number
  roas: number | null
  children: ShopifyMarketingChannelRow[]
}

function buildGroupedRows(
  channels: ShopifyMarketingChannelRow[]
): Array<
  | { kind: 'standalone'; row: ShopifyMarketingChannelRow }
  | { kind: 'parent'; group: ChannelGroup }
  | { kind: 'child'; row: ShopifyMarketingChannelRow; family: string }
> {
  // Group by family+type — only channels with the same family AND same type group together
  // e.g., google/paid + youtube/paid → "Google" group, but google/organic stays standalone
  const familyTypeMap = new Map<string, ShopifyMarketingChannelRow[]>()
  const standalone: ShopifyMarketingChannelRow[] = []

  for (const ch of channels) {
    const family = getFamily(ch.channel)
    if (family && ch.type.toLowerCase() === 'paid') {
      if (!familyTypeMap.has(family)) familyTypeMap.set(family, [])
      familyTypeMap.get(family)!.push(ch)
    } else {
      standalone.push(ch)
    }
  }

  // Build groups — only create a parent if there are 2+ children, otherwise treat as standalone
  const result: Array<
    | { kind: 'standalone'; row: ShopifyMarketingChannelRow }
    | { kind: 'parent'; group: ChannelGroup }
    | { kind: 'child'; row: ShopifyMarketingChannelRow; family: string }
  > = []

  const groups: ChannelGroup[] = []
  for (const [key, children] of familyTypeMap.entries()) {
    const family = key.split('::')[0]
    if (children.length === 1) {
      standalone.push(children[0])
      continue
    }
    const sessions = children.reduce((s, c) => s + c.sessions, 0)
    const totalSales = children.reduce((s, c) => s + c.totalSales, 0)
    const orders = children.reduce((s, c) => s + c.orders, 0)
    const adSpend = children.reduce((s, c) => s + (c.adSpend ?? 0), 0)
    groups.push({
      family,
      type: children[0].type,
      sessions,
      totalSales,
      orders,
      conversionRate: sessions > 0 ? (orders / sessions) * 100 : 0,
      adSpend,
      roas: adSpend > 0 ? totalSales / adSpend : null,
      children: children.sort((a, b) => b.sessions - a.sessions),
    })
  }

  // Merge groups and standalone, sorted by sessions desc
  const allItems: Array<{
    sessions: number
    item: ChannelGroup | ShopifyMarketingChannelRow
    isGroup: boolean
  }> = [
    ...groups.map((g) => ({ sessions: g.sessions, item: g, isGroup: true })),
    ...standalone.map((r) => ({ sessions: r.sessions, item: r, isGroup: false })),
  ].sort((a, b) => b.sessions - a.sessions)

  for (const { item, isGroup } of allItems) {
    if (isGroup) {
      const group = item as ChannelGroup
      result.push({ kind: 'parent', group })
      for (const child of group.children) {
        result.push({ kind: 'child', row: child, family: group.family })
      }
    } else {
      result.push({ kind: 'standalone', row: item as ShopifyMarketingChannelRow })
    }
  }

  return result
}

export default function ShopifyMarketingPage() {
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
  const [attributionModel, setAttributionModel] = useState<
    'first_click' | 'last_click' | 'last_non_direct'
  >('last_non_direct')
  const { data, isLoading, error, mutate } = useShopifyMarketing(
    connected,
    dateRange,
    attributionModel
  )
  const { data: journeyData, isLoading: journeyLoading } = useShopifyCustomerJourneys(
    connected,
    dateRange
  )
  // Heatmap sub-period dropdown — auto-generates weeks or months from main date range
  const [heatmapSubIndex, setHeatmapSubIndex] = useState<number | null>(null)
  const [heatmapDropdownOpen, setHeatmapDropdownOpen] = useState(false)

  const heatmapSubPeriods = useMemo(() => {
    if (!dateRange?.startDate || !dateRange?.endDate) return []
    const start = new Date(dateRange.startDate + 'T00:00:00')
    const end = new Date(dateRange.endDate + 'T00:00:00')
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const fmtISO = (d: Date) => d.toISOString().slice(0, 10)
    const periods: { label: string; startDate: string; endDate: string }[] = []

    if (diffDays <= 90) {
      // Weekly breakdown
      const cursor = new Date(start)
      while (cursor <= end) {
        const weekStart = new Date(cursor)
        const weekEnd = new Date(cursor)
        weekEnd.setDate(weekEnd.getDate() + 6)
        if (weekEnd > end) weekEnd.setTime(end.getTime())
        periods.push({
          label: `${fmt(weekStart)} – ${fmt(weekEnd)}`,
          startDate: fmtISO(weekStart),
          endDate: fmtISO(weekEnd),
        })
        cursor.setDate(cursor.getDate() + 7)
      }
    } else {
      // Monthly breakdown
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      while (cursor <= end) {
        const monthStart = new Date(Math.max(cursor.getTime(), start.getTime()))
        const monthEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
        const monthEnd = monthEndDate > end ? new Date(end) : monthEndDate
        const showYear = start.getFullYear() !== end.getFullYear()
        periods.push({
          label: cursor.toLocaleDateString('en-US', {
            month: 'short',
            ...(showYear && { year: 'numeric' }),
          }),
          startDate: fmtISO(monthStart),
          endDate: fmtISO(monthEnd),
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }

      // Add quarterly groups if > 3 months
      if (periods.length > 3) {
        const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4']
        const quarters = new Map<string, { start: Date; end: Date }>()
        const qCursor = new Date(start)
        while (qCursor <= end) {
          const q = Math.floor(qCursor.getMonth() / 3)
          const qKey = `${quarterNames[q]} ${qCursor.getFullYear()}`
          const qStart = new Date(qCursor.getFullYear(), q * 3, 1)
          const qEnd = new Date(qCursor.getFullYear(), q * 3 + 3, 0)
          if (!quarters.has(qKey)) {
            quarters.set(qKey, {
              start: qStart < start ? start : qStart,
              end: qEnd > end ? end : qEnd,
            })
          }
          qCursor.setMonth(qCursor.getMonth() + 3)
          qCursor.setDate(1)
        }
        quarters.forEach((range, label) => {
          periods.push({
            label,
            startDate: fmtISO(range.start),
            endDate: fmtISO(range.end),
          })
        })
      }
    }
    return periods
  }, [dateRange])

  // Guard sub-index against being out of range (e.g. after dateRange change)
  const effectiveSubIndex =
    heatmapSubIndex !== null && heatmapSubIndex < heatmapSubPeriods.length ? heatmapSubIndex : null

  const heatmapDateRangeOverride = useMemo(() => {
    if (effectiveSubIndex === null || !heatmapSubPeriods[effectiveSubIndex]) return null
    const sub = heatmapSubPeriods[effectiveSubIndex]
    return { startDate: sub.startDate, endDate: sub.endDate }
  }, [effectiveSubIndex, heatmapSubPeriods])

  const { data: heatmapData, isLoading: heatmapLoading } = useShopifyHeatmapSessions(
    connected && heatmapDateRangeOverride !== null,
    heatmapDateRangeOverride ?? undefined
  )

  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const isDark = theme !== 'light'

  const [search, setSearch] = useState('')
  const [attrDropdownOpen, setAttrDropdownOpen] = useState(false)
  const [sortKey, setSortKey] = useState('sessions')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())

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
      setSortDir(col === 'channel' || col === 'type' ? 'asc' : 'desc')
    }
  }

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-stone-500">
          No Shopify connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  const summary = data?.summary
  const channels = data?.channels ?? []
  const sessionsTrend = data?.sessionsTrend ?? []
  // Use sub-period data for heatmap if selected, otherwise main data
  const heatmapSessionsTrend =
    effectiveSubIndex !== null && heatmapData?.sessionsTrend
      ? heatmapData.sessionsTrend
      : sessionsTrend
  const salesTrend: { date: string; totalSales: number; orders: number }[] =
    (data as any)?.salesTrend ?? []
  const comparison: {
    sessionsChange: number | null
    salesChange: number | null
    ordersChange: number | null
    conversionChange: number | null
  } | null = (data as any)?.comparison ?? null
  const cur = summary?.currency ?? 'USD'
  const warning = data?.warning

  // New vs returning comes directly from the marketing API (REST orders: source_name + customer.orders_count)
  const getNewUsers = (ch: ShopifyMarketingChannelRow) => ch.newCustomers ?? 0
  const getReturningUsers = (ch: ShopifyMarketingChannelRow) => ch.returningCustomers ?? 0

  // Chart setup
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? '#a8a29e' : '#555555'
  const chartColors = ['#3b82f6', '#7AB55C', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

  // Build channel → dominant type lookup (highest sessions wins)
  const channelTypeLabel = useMemo(() => {
    const map: Record<string, string> = {}
    const best: Record<string, number> = {}
    for (const c of channels) {
      const lc = c.channel.toLowerCase()
      if (!best[lc] || c.sessions > best[lc]) {
        best[lc] = c.sessions
        map[lc] = c.type
      }
    }
    return map
  }, [channels])

  // Heatmap: channel × day-of-week — uses sub-period data when selected
  const heatmapOption = useMemo(() => {
    if (heatmapSessionsTrend.length === 0) return null
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    // Accumulate sessions per channel per day-of-week
    const channelDayMap: Record<string, number[]> = {}
    for (const p of heatmapSessionsTrend) {
      if (!channelDayMap[p.channel]) channelDayMap[p.channel] = [0, 0, 0, 0, 0, 0, 0]
      const jsDay = new Date(p.date + 'T00:00:00Z').getUTCDay()
      // Convert JS day (0=Sun) to Mon-first index
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1
      channelDayMap[p.channel][dayIdx] += p.sessions
    }
    const topChannels = Object.entries(channelDayMap)
      .map(([ch, days]) => ({ channel: ch, days, total: days.reduce((s, d) => s + d, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const channelNames = topChannels.map((c) => getDisplayName(c.channel)).reverse()
    const data: [number, number, number][] = []
    topChannels.forEach((c, yIdx) => {
      const y = topChannels.length - 1 - yIdx
      c.days.forEach((val, x) => {
        data.push([x, y, val])
      })
    })
    const maxVal = Math.max(...data.map((d) => d[2]), 1)

    return {
      tooltip: {
        formatter: (params: any) => {
          const [x, y, val] = params.data
          return `<div style="font-size:11px;opacity:0.6">${channelNames[y]} · ${dayNames[x]}</div><div style="font-weight:600;margin-top:2px">${formatNumber(val)} sessions</div>`
        },
        backgroundColor: isDark ? 'rgba(38,38,38,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(75,85,99,0.3)' : 'rgba(0,0,0,0.1)',
        textStyle: { color: isDark ? '#e5e7eb' : '#333', fontSize: 12 },
      },
      grid: { top: 6, right: 10, bottom: 44, left: 120 },
      xAxis: {
        type: 'category' as const,
        data: dayNames,
        splitArea: { show: true },
        axisLabel: { color: labelColor, fontSize: 12, margin: 20 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category' as const,
        data: channelNames,
        splitArea: { show: true },
        axisLabel: { color: labelColor, fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 0,
        show: false,
        inRange: {
          color: isDark
            ? [
                'rgba(30,27,46,0.9)',
                'rgba(59,82,195,0.55)',
                'rgba(99,102,241,0.7)',
                'rgba(139,92,246,0.85)',
                'rgba(168,85,247,1)',
              ]
            : [
                'rgba(238,242,255,1)',
                'rgba(199,210,254,1)',
                'rgba(129,140,248,0.8)',
                'rgba(99,102,241,0.9)',
                'rgba(79,70,229,1)',
              ],
        },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            formatter: (params: any) => {
              if (params.data[2] === 0) return ''
              const ratio = maxVal > 0 ? params.data[2] / maxVal : 0
              let style: string
              if (isDark) {
                style = ratio > 0.6 ? 'light' : 'lightSoft'
              } else {
                style = ratio > 0.4 ? 'light' : 'dark'
              }
              return `{${style}|${formatNumber(params.data[2])}}`
            },
            rich: {
              light: { fontSize: 14, color: '#fff', fontWeight: 500 },
              lightSoft: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 },
              dark: { fontSize: 14, color: 'rgba(30,30,80,0.9)', fontWeight: 500 },
            },
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: isDark ? '#0a0a0a' : '#fff',
            borderRadius: 0,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 0,
              borderColor: isDark ? '#0a0a0a' : '#fff',
              borderWidth: 1,
              opacity: 0.6,
            },
          },
        },
      ],
    }
  }, [heatmapSessionsTrend, isDark])

  // Journey insights from server-computed summary
  const journeyInsights = useMemo(() => {
    const s = journeyData?.summary
    if (!s) return null
    return {
      totalOrders: s.ordersWithJourney ?? 0,
      newCustomers: s.newCustomers ?? 0,
      returningCustomers: s.returningCustomers ?? 0,
      newPct: s.newPct ?? 0,
      returningPct: s.returningPct ?? 0,
      avgTouchpoints: s.avgMomentsPerOrder ?? 0,
      avgDaysToConvert: s.avgDaysToConversion ?? 0,
      sessionsPerPurchase: s.avgMomentsPerOrder ?? 0,
    }
  }, [journeyData])

  // Sessions trend chart: group by channel, get top 5
  const trendByChannel = useMemo(() => {
    const channelTotals: Record<string, number> = {}
    for (const point of sessionsTrend) {
      channelTotals[point.channel] = (channelTotals[point.channel] || 0) + point.sessions
    }
    const top5 = Object.entries(channelTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ch]) => ch)

    const dates = [...new Set(sessionsTrend.map((p) => p.date))].sort()
    const series = top5.map((ch, i) => {
      const dataMap: Record<string, number> = {}
      for (const p of sessionsTrend) {
        if (p.channel === ch) dataMap[p.date] = p.sessions
      }
      const type = channelTypeLabel[ch.toLowerCase()] || 'unknown'
      const color = chartColors[i % chartColors.length]
      return {
        name: `${getDisplayName(ch || 'Direct')} (${type})`,
        type: 'line' as const,
        smooth: true,
        data: dates.map((d) => dataMap[d] ?? 0),
        itemStyle: { color },
        lineStyle: { color, width: 1.5, type: 'dotted' as const },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { color, width: 2.5, type: 'solid' as const },
        },
        areaStyle: { opacity: 0.05 },
        symbol: 'none',
      }
    })

    return { dates, series }
  }, [sessionsTrend])

  // Daily sparklines
  const sessionsSparkline = useMemo(() => {
    if (sessionsTrend.length === 0) return []
    const byDate: Record<string, number> = {}
    for (const p of sessionsTrend) {
      byDate[p.date] = (byDate[p.date] ?? 0) + p.sessions
    }
    return Object.keys(byDate)
      .sort()
      .map((d) => byDate[d])
  }, [sessionsTrend])

  const salesSparkline = useMemo(() => {
    if (salesTrend.length === 0) return []
    return [...salesTrend].sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.totalSales)
  }, [salesTrend])

  const ordersSparkline = useMemo(() => {
    if (salesTrend.length === 0) return []
    return [...salesTrend].sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.orders)
  }, [salesTrend])

  // Channel pie chart
  const channelPieData = useMemo(() => {
    return channels.slice(0, 8).map((c, i) => ({
      name: `${getDisplayName(c.channel)} (${c.type})`,
      value: c.sessions,
      itemStyle: { color: chartColors[i % chartColors.length] },
    }))
  }, [channels])

  // ROAS by paid channel for bar chart
  const roasChartData = useMemo(() => {
    const paid = channels
      .filter((c) => c.roas != null && c.roas > 0)
      .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
      .slice(0, 8)
    return paid.map((c, i) => ({
      name: getDisplayName(c.channel),
      roas: c.roas!,
      adSpend: c.adSpend ?? 0,
      sales: c.totalSales,
      color: chartColors[i % chartColors.length],
    }))
  }, [channels])

  // Filtered + sorted channels
  const filtered = useMemo(() => {
    let items = [...channels]
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (c: ShopifyMarketingChannelRow) =>
          c.channel.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
      )
    }
    items.sort((a: ShopifyMarketingChannelRow, b: ShopifyMarketingChannelRow) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'channel':
          aVal = a.channel
          bVal = b.channel
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'sessions':
          aVal = a.sessions
          bVal = b.sessions
          break
        case 'totalSales':
          aVal = a.totalSales
          bVal = b.totalSales
          break
        case 'orders':
          aVal = a.orders
          bVal = b.orders
          break
        case 'conversionRate':
          aVal = a.conversionRate
          bVal = b.conversionRate
          break
        case 'adSpend':
          aVal = a.adSpend ?? 0
          bVal = b.adSpend ?? 0
          break
        case 'roas':
          aVal = a.roas ?? -1
          bVal = b.roas ?? -1
          break
        default:
          aVal = a.sessions
          bVal = b.sessions
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [channels, search, sortKey, sortDir])

  const groupedRows = useMemo(() => buildGroupedRows(filtered), [filtered])

  const toggleFamily = (family: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(family)) next.delete(family)
      else next.add(family)
      return next
    })
  }

  const tooltipStyle = {
    trigger: 'axis' as const,
    backgroundColor: isDark ? '#1e1e2e' : '#fff',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div
        className={cn(
          'mb-10 pt-2 pb-4 border-b shadow-sm',
          isLight
            ? 'border-stone-200/80 shadow-stone-200/50'
            : 'border-white/[0.06] shadow-black/20'
        )}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">Marketing</h1>
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
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load marketing data. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
        </div>
      ) : (
        <>
          {warning && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{warning}</p>
            </div>
          )}

          {/* KPI Strip */}
          <KPIStrip
            isLight={isLight}
            isLoading={isLoading}
            cards={
              summary
                ? [
                    {
                      label: 'Sessions',
                      tooltip: {
                        description:
                          'Total online store browsing sessions during the selected period.',
                        note: 'A session ends after 30 minutes of inactivity or at midnight.',
                      },
                      kpi: {
                        value: summary.totalSessions,
                        changePercent: comparison?.sessionsChange,
                        sparkline: sessionsSparkline,
                      },
                      format: (v) => formatNumber(v),
                    },
                    {
                      label: 'Sales Attributed',
                      tooltip: {
                        description:
                          'Total sales value from orders attributed to online store sessions.',
                        note: 'Source: ShopifyQL sales dataset (total_sales metric).',
                      },
                      kpi: {
                        value: summary.totalSales,
                        changePercent: comparison?.salesChange,
                        sparkline: salesSparkline,
                      },
                      format: (v) => formatCurrency(v, cur),
                    },
                    {
                      label: 'Orders Attributed',
                      tooltip: {
                        description: 'Number of orders attributed to online store sessions.',
                      },
                      kpi: {
                        value: summary.totalOrders,
                        changePercent: comparison?.ordersChange,
                        sparkline: ordersSparkline,
                      },
                      format: (v) => formatNumber(v),
                    },
                    {
                      label: 'Conversion Rate',
                      tooltip: {
                        description: 'Percentage of sessions that resulted in an order.',
                        calculationTooltip: {
                          formula: '(Orders ÷ Sessions) × 100',
                          components: [
                            { label: 'Orders', value: formatNumber(summary.totalOrders) },
                            { label: '÷ Sessions', value: formatNumber(summary.totalSessions) },
                            {
                              label: '= Conversion Rate',
                              value: summary.conversionRate.toFixed(2) + '%',
                              highlight: true,
                            },
                          ],
                        },
                      },
                      kpi: {
                        value: summary.conversionRate,
                        changePercent: comparison?.conversionChange,
                      },
                      format: (v) => v.toFixed(2) + '%',
                    },
                    {
                      label: 'AOV Attributed',
                      tooltip: {
                        description: 'Average order value from attributed sales.',
                        calculationTooltip: {
                          formula: 'Attributed Sales ÷ Attributed Orders',
                          components: [
                            {
                              label: 'Attributed Sales',
                              value: formatCurrency(summary.totalSales, cur),
                            },
                            {
                              label: '÷ Attributed Orders',
                              value: formatNumber(summary.totalOrders),
                            },
                            {
                              label: '= AOV',
                              value: formatCurrency(
                                summary.totalOrders > 0
                                  ? summary.totalSales / summary.totalOrders
                                  : 0,
                                cur
                              ),
                              highlight: true,
                            },
                          ],
                        },
                      },
                      kpi: {
                        value:
                          summary.totalOrders > 0 ? summary.totalSales / summary.totalOrders : 0,
                      },
                      format: (v) => formatCurrency(v, cur),
                    },
                    {
                      label: 'ROAS',
                      tooltip: {
                        description:
                          'Return on Ad Spend — revenue generated for every dollar spent on advertising.',
                        calculationTooltip: {
                          formula: 'Attributed Sales ÷ Total Ad Spend',
                          components: [
                            {
                              label: 'Attributed Sales',
                              value: formatCurrency(summary.totalSales, cur),
                            },
                            {
                              label: '÷ Total Ad Spend',
                              value: formatCurrency(summary.totalAdSpend ?? 0, cur),
                            },
                            {
                              label: '= ROAS',
                              value:
                                summary.roas != null
                                  ? summary.roas.toFixed(2) + 'x'
                                  : 'N/A (no ad spend)',
                              highlight: true,
                            },
                          ],
                        },
                        note: 'Ad spend is sourced from Shopify Marketing Activities (Google, Meta, etc.). Requires connected marketing channel apps.',
                      },
                      kpi: {
                        value: summary.roas ?? 0,
                      },
                      format: (v) => (summary.roas != null ? v.toFixed(2) + 'x' : '—'),
                    },
                  ]
                : []
            }
          />

          {/* Charts */}
          <div
            className={cn(
              'grid @xl:grid-cols-2 gap-5',
              isLight
                ? '@xl:[&>*:first-child]:border-r @xl:[&>*:first-child]:border-stone-200 @xl:[&>*:first-child]:pr-5'
                : '@xl:[&>*:first-child]:border-r @xl:[&>*:first-child]:border-white/[0.08] @xl:[&>*:first-child]:pr-5'
            )}
          >
            {/* Sessions by Channel Over Time */}
            {trendByChannel.dates.length > 0 && trendByChannel.series.length > 0 && (
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Sessions by Top Channels Over Time
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                <ReactECharts
                  option={{
                    tooltip: tooltipStyle,
                    legend: {
                      bottom: 0,
                      textStyle: { color: labelColor, fontSize: 12 },
                      itemWidth: 12,
                      itemHeight: 8,
                    },
                    grid: { top: 16, right: 16, bottom: 80, left: 48 },
                    xAxis: {
                      type: 'category',
                      data: trendByChannel.dates.map((d) => {
                        const dt = new Date(d + 'T00:00:00Z')
                        return dt.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'UTC',
                        })
                      }),
                      axisLine: { lineStyle: { color: gridColor } },
                      axisLabel: {
                        color: labelColor,
                        fontSize: 12,
                        interval: 3,
                        rotate: trendByChannel.dates.length > 14 ? 30 : 0,
                      },
                      splitLine: { show: false },
                    },
                    yAxis: {
                      type: 'value',
                      axisLabel: { color: labelColor, fontSize: 12 },
                      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
                    },
                    series: trendByChannel.series,
                  }}
                  style={{ width: '100%', height: 360 }}
                  opts={{ renderer: 'canvas' }}
                />
              </section>
            )}

            {/* Sessions by Channel (Donut) */}
            {channelPieData.length > 0 && (
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Sessions by Channel
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                <ReactECharts
                  option={{
                    tooltip: {
                      backgroundColor: isDark ? '#1e1e2e' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
                      formatter: (params: any) => {
                        const ch = channels.find((c) => c.channel === params.name)
                        return `<div style="font-size:11px;opacity:0.6">${params.name}</div>
                          <div style="font-weight:600;margin-top:2px">${formatNumber(params.value)} sessions</div>
                          <div style="font-size:11px;opacity:0.6;margin-top:2px">${formatCurrency(ch?.totalSales ?? 0, cur)} sales</div>
                          <div style="font-size:11px;opacity:0.6">${(params.percent ?? 0).toFixed(1)}%</div>`
                      },
                    },
                    series: [
                      {
                        type: 'pie',
                        radius: ['50%', '75%'],
                        center: ['50%', '50%'],
                        avoidLabelOverlap: true,
                        itemStyle: {
                          borderRadius: 0,
                          borderColor: isDark ? '#1e1e2e' : '#fff',
                          borderWidth: 2,
                        },
                        label: {
                          show: true,
                          position: 'outside',
                          color: labelColor,
                          fontSize: 12,
                          formatter: '{b}',
                        },
                        labelLine: { lineStyle: { color: gridColor } },
                        data: channelPieData,
                      },
                    ],
                  }}
                  style={{ width: '100%', height: 300 }}
                  opts={{ renderer: 'canvas' }}
                />
              </section>
            )}
          </div>

          {/* ROAS by Paid Channel */}
          {roasChartData.length > 0 && (
            <div className="pt-4 pb-5">
              <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                ROAS by Paid Channel
              </p>
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' },
                    backgroundColor: isDark ? '#1e1e2e' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
                    formatter: (params: any) => {
                      const p = Array.isArray(params) ? params[0] : params
                      const item = roasChartData.find((d) => d.name === p.name)
                      if (!item) return ''
                      return `<div style="font-size:11px;opacity:0.6">${item.name}</div>
                        <div style="font-weight:600;margin-top:2px">ROAS: ${item.roas.toFixed(2)}x</div>
                        <div style="font-size:11px;opacity:0.6;margin-top:2px">Ad Spend: ${formatCurrency(item.adSpend, cur)}</div>
                        <div style="font-size:11px;opacity:0.6">Sales: ${formatCurrency(item.sales, cur)}</div>`
                    },
                  },
                  grid: { top: 10, right: 60, bottom: 10, left: 100 },
                  xAxis: {
                    type: 'value',
                    axisLabel: {
                      color: labelColor,
                      fontSize: 10,
                      formatter: (v: number) => v.toFixed(1) + 'x',
                    },
                    splitLine: { lineStyle: { color: gridColor } },
                  },
                  yAxis: {
                    type: 'category',
                    data: [...roasChartData].reverse().map((d) => d.name),
                    axisLabel: { color: labelColor, fontSize: 11 },
                    axisLine: { show: false },
                    axisTick: { show: false },
                  },
                  series: [
                    {
                      type: 'bar',
                      data: [...roasChartData].reverse().map((d) => ({
                        value: d.roas,
                        itemStyle: {
                          color: d.roas >= 3 ? '#22c55e' : d.roas >= 2 ? '#f59e0b' : '#ef4444',
                          borderRadius: 0,
                        },
                      })),
                      barWidth: 20,
                      label: {
                        show: true,
                        position: 'right',
                        fontSize: 11,
                        fontWeight: 600,
                        color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                        formatter: (params: any) => params.value.toFixed(2) + 'x',
                      },
                      markLine: {
                        silent: true,
                        symbol: 'none',
                        lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 },
                        label: {
                          formatter: '3.0x',
                          color: '#f59e0b',
                          fontSize: 10,
                          position: 'end',
                        },
                        data: [{ xAxis: 3 }],
                      },
                    },
                  ],
                }}
                style={{ width: '100%', height: Math.max(180, roasChartData.length * 36 + 40) }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          )}

          {/* Customer Journey Insights */}
          <div className="pt-4 pb-5">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Customer Journey
              </h2>
              <div className="h-px flex-1 section-divider-line" />
              {journeyLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent" />
              )}
            </div>

            {journeyLoading && !journeyInsights ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-5 h-5 animate-spin text-stone-500" />
              </div>
            ) : journeyInsights ? (
              <div className="grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-6 gap-4">
                {[
                  {
                    icon: <UserPlus className="w-4 h-4 text-emerald-500" />,
                    label: 'New Customers',
                    value: journeyInsights.newCustomers,
                    sub: `${journeyInsights.newPct}% of orders`,
                    desc: 'Orders placed by first-time buyers (customerOrderIndex = 1).',
                    formula: `New customers = orders where customerOrderIndex is 1\n${journeyInsights.newCustomers} out of ${journeyInsights.totalOrders} orders`,
                  },
                  {
                    icon: <UserCheck className="w-4 h-4 text-blue-500" />,
                    label: 'Returning',
                    value: journeyInsights.returningCustomers,
                    sub: `${journeyInsights.returningPct}% of orders`,
                    desc: 'Orders placed by customers who have purchased before (customerOrderIndex > 1).',
                    formula: `Returning = orders where customerOrderIndex > 1\n${journeyInsights.returningCustomers} out of ${journeyInsights.totalOrders} orders`,
                  },
                  {
                    icon: <MousePointerClick className="w-4 h-4 text-amber-500" />,
                    label: 'Avg Touchpoints',
                    value: journeyInsights.avgTouchpoints,
                    sub: 'interactions per order',
                    desc: 'Average number of store interactions (page views, visits) before a customer completes a purchase.',
                    formula: `Total touchpoints across all orders ÷ number of orders\n= ${journeyInsights.avgTouchpoints} touchpoints per order`,
                  },
                  {
                    icon: <Route className="w-4 h-4 text-purple-500" />,
                    label: 'Sessions / Purchase',
                    value: journeyInsights.sessionsPerPurchase,
                    sub: 'avg visits before buying',
                    desc: "Average number of separate browsing sessions a customer has before making a purchase. Based on Shopify's momentsCount per order.",
                    formula: `Sum of all momentsCount ÷ total orders\n= ${journeyInsights.sessionsPerPurchase} sessions per purchase`,
                  },
                  {
                    icon: <Clock className="w-4 h-4 text-cyan-500" />,
                    label: 'Days to Convert',
                    value: journeyInsights.avgDaysToConvert,
                    sub: 'avg first visit to purchase',
                    desc: "Average number of days between a customer's first recorded store visit and their purchase. Only includes orders with tracked first visit data.",
                    formula: `Sum of daysToConversion for all orders ÷ orders with conversion data\n= ${journeyInsights.avgDaysToConvert} days average`,
                  },
                  {
                    icon: <Users className="w-4 h-4 text-stone-400" />,
                    label: 'Orders Tracked',
                    value: journeyInsights.totalOrders,
                    sub: 'with journey data',
                    desc: 'Total orders that have customer journey tracking data from Shopify. Based on the most recent 50 orders.',
                    formula: `Orders where customerJourneySummary.ready = true\n= ${journeyInsights.totalOrders} orders`,
                  },
                ].map(({ icon, label, value, sub, desc, formula }) => (
                  <TooltipProvider key={label} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'p-4 cursor-default',
                            isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {icon}
                            <span className="text-[11px] uppercase tracking-wider theme-text-secondary font-medium">
                              {label}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'text-2xl font-mono font-semibold tabular-nums',
                              isLight ? 'text-stone-900' : 'text-white'
                            )}
                          >
                            {value}
                          </div>
                          <div className="text-[11px] theme-text-secondary mt-1">{sub}</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        sideOffset={8}
                        className="kpi-tooltip w-80 max-w-none rounded-lg shadow-xl border z-[100] p-3"
                      >
                        <div
                          className="mb-2 pb-2"
                          style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
                            Definition
                          </div>
                          <p className="text-xs theme-text-primary leading-relaxed">{desc}</p>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
                            How it's calculated
                          </div>
                          <p className="text-[11px] font-mono theme-text-secondary leading-relaxed whitespace-pre-line">
                            {formula}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ) : (
              <p className="text-sm theme-text-secondary">Customer journey data unavailable.</p>
            )}
          </div>

          {/* Conversion Funnel */}
          {summary && summary.totalSessions > 0 && (
            <div className="pt-4 pb-5">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Conversion Funnel
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              {(() => {
                const convRate = summary.conversionRate
                const aov = summary.totalOrders > 0 ? summary.totalSales / summary.totalOrders : 0

                // Fixed visual proportions — gentle taper, always readable
                // Sessions 90→70, Orders 70→50, Revenue 50→35
                const stages = [
                  {
                    label: 'Sessions',
                    value: formatNumber(summary.totalSessions),
                    color: '#3b82f6',
                    widthTop: 90,
                    widthBottom: 70,
                  },
                  {
                    label: 'Orders',
                    value: formatNumber(summary.totalOrders),
                    color: '#10b981',
                    widthTop: 70,
                    widthBottom: 50,
                  },
                  {
                    label: 'Revenue',
                    value: formatCurrency(summary.totalSales, cur),
                    color: '#f59e0b',
                    widthTop: 50,
                    widthBottom: 35,
                  },
                ]

                const connectors = [
                  {
                    label: `${convRate.toFixed(2)}% conversion`,
                    dropoff: `${(100 - convRate).toFixed(1)}% drop-off`,
                  },
                  { label: `${formatCurrency(aov, cur)} AOV`, dropoff: null },
                ]

                return (
                  <div className="max-w-2xl mx-auto">
                    <div className="flex flex-col items-center">
                      {stages.map((stage, i) => {
                        const insetTop = (100 - stage.widthTop) / 2
                        const insetBottom = (100 - stage.widthBottom) / 2
                        return (
                          <div key={stage.label} className="w-full flex flex-col items-center">
                            <div className="w-full relative" style={{ height: 68 }}>
                              <div
                                className="absolute inset-0 flex items-center justify-center"
                                style={{
                                  backgroundColor: stage.color,
                                  clipPath: `polygon(${insetTop}% 0%, ${100 - insetTop}% 0%, ${100 - insetBottom}% 100%, ${insetBottom}% 100%)`,
                                }}
                              >
                                <div className="text-center z-10">
                                  <div className="text-[11px] uppercase tracking-wider font-medium text-white/80">
                                    {stage.label}
                                  </div>
                                  <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
                                    {stage.value}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {i < stages.length - 1 && (
                              <div className="flex items-center justify-center gap-6 py-1">
                                <span className="text-[14px] font-mono font-medium theme-text-secondary">
                                  {connectors[i].label}
                                </span>
                                {connectors[i].dropoff && (
                                  <span className="text-[14px] text-red-400/70">
                                    {connectors[i].dropoff}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Journey stats */}
                    {journeyInsights && (
                      <div
                        className={cn(
                          'flex flex-wrap justify-center gap-x-10 gap-y-2 pt-5 mt-4 border-t',
                          isLight ? 'border-stone-200' : 'border-white/[0.08]'
                        )}
                      >
                        {[
                          {
                            label: 'Avg Touchpoints',
                            value: String(journeyInsights.avgTouchpoints),
                          },
                          {
                            label: 'Sessions / Purchase',
                            value: String(journeyInsights.sessionsPerPurchase),
                          },
                          {
                            label: 'Days to Convert',
                            value: String(journeyInsights.avgDaysToConvert),
                          },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <span className="text-[11px] uppercase tracking-wider theme-text-secondary font-medium mr-2">
                              {label}
                            </span>
                            <span
                              className={cn(
                                'text-sm font-mono font-semibold tabular-nums',
                                isLight ? 'text-stone-900' : 'text-white'
                              )}
                            >
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Session Heatmap */}
          {(heatmapOption || effectiveSubIndex !== null) && (
            <div className="pt-4 pb-5">
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                    Session Heatmap
                  </h2>
                  <div className="h-px flex-1 section-divider-line" />
                </div>
                <div className="text-right mt-1">
                  <span className="text-[11px] theme-text-secondary">Channel × Day of Week</span>
                </div>
              </div>

              {heatmapLoading && effectiveSubIndex !== null ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-5 h-5 animate-spin text-stone-500" />
                </div>
              ) : heatmapOption ? (
                <ReactECharts
                  option={heatmapOption}
                  style={{
                    width: '100%',
                    height: Math.max(200, (heatmapOption.yAxis as any).data.length * 36 + 40),
                  }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-sm theme-text-secondary">No session data for this period.</p>
                </div>
              )}
            </div>
          )}

          {/* Marketing Channels title + Search */}
          <div className="flex items-center justify-between gap-4 flex-wrap pt-4">
            <h2 className="text-base font-normal uppercase tracking-wider theme-text-primary">
              Marketing Channels
            </h2>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search channels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                  'border bg-transparent',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]',
                  isLight ? 'text-stone-900' : 'text-white',
                  'placeholder:text-stone-400',
                  'focus:border-amber-500/40'
                )}
              />
            </div>

            {/* Attribution Model Dropdown */}
            <div className="relative">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setAttrDropdownOpen((prev) => !prev)}
                      className={cn(
                        'flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors',
                        'border whitespace-nowrap',
                        isLight
                          ? 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                          : 'border-white/[0.08] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
                      )}
                    >
                      {attributionModel === 'first_click'
                        ? 'First Click'
                        : attributionModel === 'last_non_direct'
                          ? 'Last Non-Direct'
                          : 'Last Click'}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    className={cn(
                      'max-w-xs text-xs',
                      isLight ? 'bg-white text-stone-700' : 'bg-stone-900 text-stone-300'
                    )}
                  >
                    <p className="font-medium mb-1">Attribution Model</p>
                    <p>Controls how sales credit is assigned to channels.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {attrDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setAttrDropdownOpen(false)} />
                  <div
                    className={cn(
                      'absolute right-0 top-full mt-1 z-30 w-56 rounded-lg border shadow-lg py-1',
                      isLight
                        ? 'bg-white border-stone-200 shadow-stone-200/50'
                        : 'bg-[#141414] border-white/[0.08] shadow-black/40'
                    )}
                  >
                    {(
                      [
                        {
                          value: 'first_click' as const,
                          label: 'First Click',
                          desc: 'Credit to the first touchpoint',
                        },
                        {
                          value: 'last_click' as const,
                          label: 'Last Click',
                          desc: 'Credit to the last touchpoint',
                        },
                        {
                          value: 'last_non_direct' as const,
                          label: 'Last Non-Direct',
                          desc: 'Last touch, skipping Direct',
                        },
                      ] as const
                    ).map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => {
                          setAttributionModel(value)
                          setAttrDropdownOpen(false)
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 flex items-center justify-between transition-colors',
                          attributionModel === value
                            ? cn(
                                isLight
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-amber-500/10 text-amber-400'
                              )
                            : cn(
                                isLight
                                  ? 'text-stone-700 hover:bg-stone-50'
                                  : 'text-stone-300 hover:bg-white/[0.04]'
                              )
                        )}
                      >
                        <div>
                          <div className="text-xs font-medium">{label}</div>
                          <div
                            className={cn(
                              'text-[10px] mt-0.5',
                              isLight ? 'text-stone-400' : 'text-stone-500'
                            )}
                          >
                            {desc}
                          </div>
                        </div>
                        {attributionModel === value && (
                          <div className={cn('w-1.5 h-1.5 rounded-full', 'bg-amber-500')} />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top Marketing Channels Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                <tr
                  className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                >
                  {[
                    {
                      col: 'channel',
                      label: 'Channel',
                      align: 'left' as const,
                      desc: 'The traffic source or referring site that brought visitors to your store.',
                      diff: "Shopify's Attribution page uses an internal taxonomy to group channels (e.g., Google Search, YouTube under Google). Our data comes from ShopifyQL which returns raw referring_channel values.",
                    },
                    {
                      col: 'type',
                      label: 'Type',
                      align: 'left' as const,
                      desc: 'The traffic category: paid, organic, direct, social, or unknown.',
                      diff: 'Shopify may classify the same channel under a different type depending on the attribution model selected.',
                    },
                    {
                      col: 'sessions',
                      label: 'Sessions',
                      align: 'right' as const,
                      desc: 'Total browsing sessions from this channel.',
                      formula: 'A session ends after 30 minutes of inactivity or at midnight.',
                      diff: "Shopify's Attribution page applies attribution models (e.g., last non-direct click) to redistribute sessions. Our data shows raw session counts per channel.",
                    },
                    {
                      col: 'totalSales',
                      label: 'Sales',
                      align: 'right' as const,
                      desc: 'Total sales from orders where this channel was the last referring source.',
                      formula: 'Sales = gross sales - discounts - returns + taxes + shipping',
                      diff: 'Shopify\'s Attribution page redistributes sales credit across channels using the selected model. For example, "Direct" may show higher sales here because attribution models would reassign some of those sales to marketing channels.',
                    },
                    {
                      col: 'orders',
                      label: 'Orders',
                      align: 'right' as const,
                      desc: 'Number of orders where this channel was the last referring source.',
                      diff: "Similar to sales — Shopify's attribution models redistribute order credit. Direct will appear inflated and marketing channels deflated compared to the Attribution page.",
                    },
                    {
                      col: 'conversionRate',
                      label: 'Conv. Rate',
                      align: 'right' as const,
                      desc: 'Percentage of sessions that resulted in an order.',
                      formula: 'Conversion rate = orders ÷ sessions × 100',
                      diff: "Since both sessions and orders differ from Shopify's Attribution page, conversion rates will also vary.",
                    },
                    {
                      col: 'adSpend',
                      label: 'Ad Spend',
                      align: 'right' as const,
                      desc: 'Total advertising spend attributed to this channel.',
                      formula:
                        'Sum of adSpend from Shopify Marketing Activities matching this channel.',
                      diff: 'Sourced from Marketing Activities API. Requires connected marketing channel apps (Google, Meta, etc.) that report spend back to Shopify.',
                    },
                    {
                      col: 'roas',
                      label: 'ROAS',
                      align: 'right' as const,
                      desc: 'Return on ad spend. Revenue generated for every dollar spent on advertising.',
                      formula: 'ROAS = sales ÷ ad spend',
                      diff: 'Only shown for paid channels with ad spend data. Channels without connected marketing apps will show —.',
                    },
                    {
                      col: 'newUsers',
                      label: 'New',
                      align: 'right' as const,
                      desc: 'Orders from first-time customers attributed to this channel.',
                      formula: 'Count of orders where customer_order_index = 1',
                      diff: 'Derived from Shopify customer journey data. Only available for orders with journey tracking enabled.',
                    },
                    {
                      col: 'returningUsers',
                      label: 'Returning',
                      align: 'right' as const,
                      desc: 'Orders from repeat customers attributed to this channel.',
                      formula: 'Count of orders where customer_order_index > 1',
                      diff: 'Derived from Shopify customer journey data. Only available for orders with journey tracking enabled.',
                    },
                    {
                      col: 'ctr',
                      label: 'CTR',
                      align: 'right' as const,
                      desc: 'Click-through rate. Percentage of impressions that resulted in a click.',
                      formula: 'CTR = clicks ÷ impressions × 100',
                      diff: "Requires impression and click data from Google Ads or Meta Ads. Not available through Shopify's API.",
                    },
                  ].map(({ col, label, align, desc, formula, diff }) => (
                    <th
                      key={col}
                      className={cn(
                        'px-4 py-3 text-[14px] font-medium uppercase tracking-wider text-stone-500',
                        align === 'right' ? 'text-right' : 'text-left'
                      )}
                    >
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSort(col)}
                              className={cn(
                                'inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors cursor-pointer',
                                align === 'right' && 'ml-auto'
                              )}
                            >
                              {label} <SortIcon col={col} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            sideOffset={8}
                            className="kpi-tooltip w-80 max-w-none rounded-lg shadow-xl border z-[100] p-3"
                          >
                            <div
                              className="mb-2 pb-2"
                              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
                                Definition
                              </div>
                              <p className="text-xs theme-text-primary leading-relaxed">{desc}</p>
                            </div>
                            {formula && (
                              <div
                                className="mb-2 pb-2"
                                style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                              >
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
                                  Formula
                                </div>
                                <p className="text-[11px] font-mono theme-text-secondary leading-relaxed">
                                  {formula}
                                </p>
                              </div>
                            )}
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mb-1">
                                Why different from Shopify
                              </div>
                              <p className="text-[11px] theme-text-secondary leading-relaxed">
                                {diff}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((entry, index) => {
                  if (entry.kind === 'parent') {
                    const { group } = entry
                    const isOpen = expandedFamilies.has(group.family)
                    return (
                      <tr
                        key={`parent-${group.family}-${group.type}`}
                        onClick={() => toggleFamily(group.family)}
                        className={cn(
                          'transition-colors cursor-pointer',
                          isLight ? 'even:bg-stone-200/50' : 'even:bg-white/[0.08]',
                          isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                        )}
                      >
                        <td
                          className={cn(
                            'px-4 py-3 font-medium',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                            )}
                            {group.family}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <TypeBadge type={group.type} isLight={isLight} />
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-mono tabular-nums',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          {formatNumber(group.sessions)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-theme-green">
                          {formatCurrency(group.totalSales, cur)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-mono tabular-nums',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          {group.orders}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-mono tabular-nums',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          {group.conversionRate.toFixed(2)}%
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-mono tabular-nums',
                            group.adSpend > 0 ? 'text-amber-500' : 'text-stone-500'
                          )}
                        >
                          {group.adSpend > 0 ? formatCurrency(group.adSpend, cur) : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-mono tabular-nums font-semibold',
                            group.roas != null
                              ? group.roas >= 3
                                ? 'text-emerald-500'
                                : group.roas >= 2
                                  ? 'text-amber-500'
                                  : 'text-red-400'
                              : 'text-stone-500'
                          )}
                        >
                          {group.roas != null ? group.roas.toFixed(2) + 'x' : '—'}
                        </td>
                        {(() => {
                          const groupNew = group.children.reduce(
                            (s, c) => s + (c.newCustomers ?? 0),
                            0
                          )
                          const groupRet = group.children.reduce(
                            (s, c) => s + (c.returningCustomers ?? 0),
                            0
                          )
                          return (
                            <>
                              <td
                                className={cn(
                                  'px-4 py-3 text-right font-mono tabular-nums',
                                  groupNew > 0
                                    ? isLight
                                      ? 'text-blue-600'
                                      : 'text-blue-400'
                                    : 'text-stone-500'
                                )}
                              >
                                {groupNew > 0 ? groupNew : '—'}
                              </td>
                              <td
                                className={cn(
                                  'px-4 py-3 text-right font-mono tabular-nums',
                                  groupRet > 0
                                    ? isLight
                                      ? 'text-purple-600'
                                      : 'text-purple-400'
                                    : 'text-stone-500'
                                )}
                              >
                                {groupRet > 0 ? groupRet : '—'}
                              </td>
                            </>
                          )
                        })()}
                        <td className="px-4 py-3 text-right text-stone-500">—</td>
                      </tr>
                    )
                  }

                  if (entry.kind === 'child') {
                    if (!expandedFamilies.has(entry.family)) return null
                    const { row: ch } = entry
                    return (
                      <tr
                        key={`child-${entry.family}-${ch.channel}-${ch.type}`}
                        className={cn(
                          'transition-colors',
                          isLight
                            ? 'bg-stone-50/50 hover:bg-stone-100'
                            : 'bg-white/[0.01] hover:bg-white/[0.04]'
                        )}
                      >
                        <td
                          className={cn(
                            'px-4 py-2.5 pl-11',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                        >
                          {getDisplayName(ch.channel)}
                        </td>
                        <td className="px-4 py-2.5">
                          <TypeBadge type={ch.type} isLight={isLight} />
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                        >
                          {formatNumber(ch.sessions)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-theme-green/80">
                          {formatCurrency(ch.totalSales, cur)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                        >
                          {ch.orders}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                        >
                          {ch.conversionRate.toFixed(2)}%
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            (ch.adSpend ?? 0) > 0 ? 'text-amber-500/80' : 'text-stone-500'
                          )}
                        >
                          {(ch.adSpend ?? 0) > 0 ? formatCurrency(ch.adSpend!, cur) : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            ch.roas != null
                              ? ch.roas >= 3
                                ? 'text-emerald-500/80'
                                : ch.roas >= 2
                                  ? 'text-amber-500/80'
                                  : 'text-red-400/80'
                              : 'text-stone-500'
                          )}
                        >
                          {ch.roas != null ? ch.roas.toFixed(2) + 'x' : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            getNewUsers(ch) > 0
                              ? isLight
                                ? 'text-blue-600/80'
                                : 'text-blue-400/80'
                              : 'text-stone-500'
                          )}
                        >
                          {getNewUsers(ch) > 0 ? getNewUsers(ch) : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono tabular-nums',
                            getReturningUsers(ch) > 0
                              ? isLight
                                ? 'text-purple-600/80'
                                : 'text-purple-400/80'
                              : 'text-stone-500'
                          )}
                        >
                          {getReturningUsers(ch) > 0 ? getReturningUsers(ch) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-stone-500">—</td>
                      </tr>
                    )
                  }

                  // standalone
                  const { row: ch } = entry
                  return (
                    <tr
                      key={`standalone-${ch.channel}-${ch.type}`}
                      className={cn(
                        'transition-colors',
                        isLight ? 'even:bg-stone-200/50' : 'even:bg-white/[0.08]',
                        isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <td
                        className={cn(
                          'px-4 py-3 font-medium',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 flex-shrink-0" />
                          {getDisplayName(ch.channel)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={ch.type} isLight={isLight} />
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {formatNumber(ch.sessions)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-theme-green">
                        {formatCurrency(ch.totalSales, cur)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {ch.orders}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {ch.conversionRate.toFixed(2)}%
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          (ch.adSpend ?? 0) > 0 ? 'text-amber-500' : 'text-stone-500'
                        )}
                      >
                        {(ch.adSpend ?? 0) > 0 ? formatCurrency(ch.adSpend!, cur) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums font-semibold',
                          ch.roas != null
                            ? ch.roas >= 3
                              ? 'text-emerald-500'
                              : ch.roas >= 2
                                ? 'text-amber-500'
                                : 'text-red-400'
                            : 'text-stone-500'
                        )}
                      >
                        {ch.roas != null ? ch.roas.toFixed(2) + 'x' : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          getNewUsers(ch) > 0
                            ? isLight
                              ? 'text-blue-600'
                              : 'text-blue-400'
                            : 'text-stone-500'
                        )}
                      >
                        {getNewUsers(ch) > 0 ? getNewUsers(ch) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          getReturningUsers(ch) > 0
                            ? isLight
                              ? 'text-purple-600'
                              : 'text-purple-400'
                            : 'text-stone-500'
                        )}
                      >
                        {getReturningUsers(ch) > 0 ? getReturningUsers(ch) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-500">—</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-stone-500 whitespace-nowrap"
                    >
                      {channels.length === 0
                        ? 'No session data available for this period.'
                        : 'No channels matching search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
