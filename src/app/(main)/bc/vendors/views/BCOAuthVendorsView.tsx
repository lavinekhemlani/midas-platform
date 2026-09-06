'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBCVendors } from '../../hooks/useBCVendors'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils/currency'
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useTheme } from '@/hooks/useTheme'
import { pdf } from '@react-pdf/renderer'
import { BCVendorsPDF } from '../components'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { BCVendorDetailView } from '../[vendorId]/views/BCVendorDetailView'

type VendorSortKey = 'displayName' | 'number' | 'email' | 'balance'
type APSortKey =
  | 'name'
  | 'balanceDue'
  | 'currentAmount'
  | 'period1Amount'
  | 'period2Amount'
  | 'period3Amount'
type SortDir = 'asc' | 'desc'

export function BCOAuthVendorsView({ connectionId }: { connectionId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Build a query string that preserves connectionId (and any other params) for sub-navigation
  const detailQueryString = useMemo(() => {
    const params = new URLSearchParams()
    // Forward all current search params (connectionId, bc, schema, etc.)
    searchParams.forEach((value, key) => {
      params.set(key, value)
    })
    // Ensure connectionId is present even if not in URL (e.g. resolved from active connection)
    if (!params.has('connectionId') && connectionId) {
      params.set('connectionId', connectionId)
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [searchParams, connectionId])

  const {
    vendors,
    agedPayables,
    agedPayablesTotal,
    summary,
    companyName,
    lcyCurrencyCode,
    isLoading,
    error,
    mutate,
  } = useBCVendors(connectionId)
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)
  const [activeTab, setActiveTab] = useState<'vendors' | 'aged'>('aged')
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState('all')
  const [vendorSortKey, setVendorSortKey] = useState<VendorSortKey>('displayName')
  const [vendorSortDir, setVendorSortDir] = useState<SortDir>('asc')
  const [apSortKey, setAPSortKey] = useState<APSortKey>('balanceDue')
  const [apSortDir, setAPSortDir] = useState<SortDir>('desc')
  const [hiddenVendors, setHiddenVendors] = useState<Set<string>>(new Set())
  const [filterSearch, setFilterSearch] = useState('')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    const hasData = vendors.length > 0 || !!summary
    const allDoneLoading = !isLoading
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [welcomeContext, isLoading, vendors.length, summary])

  // LCY = Local Currency from BC company info; used for aged payables & totals
  const lcyCurrency = lcyCurrencyCode || ''

  const [agedSearchQuery, setAgedSearchQuery] = useState('')

  // All unique vendor names for the filter popover
  const allVendorNames = useMemo(() => {
    const names = new Set<string>()
    vendors.forEach((v: any) => {
      if (v.displayName) names.add(v.displayName)
    })
    agedPayables.forEach((ap: any) => {
      if (ap.name) names.add(ap.name)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [vendors, agedPayables])

  // Filter to vendors with a balance, then sort by user-selected key
  const sortedAgedPayables = useMemo(() => {
    let items = agedPayables.filter((ap: any) => Math.abs(ap.balanceDue || 0) > 0)
    if (hiddenVendors.size > 0) {
      items = items.filter((ap: any) => !hiddenVendors.has(ap.name))
    }
    if (agedSearchQuery) {
      const q = agedSearchQuery.toLowerCase()
      items = items.filter(
        (ap: any) =>
          ap.name?.toLowerCase().includes(q) || ap.vendorNumber?.toLowerCase().includes(q)
      )
    }
    items.sort((a: any, b: any) => {
      const aVal = a[apSortKey] ?? ''
      const bVal = b[apSortKey] ?? ''
      if (typeof aVal === 'string') {
        return apSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return apSortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [agedPayables, hiddenVendors, agedSearchQuery, apSortKey, apSortDir])

  const formatAged = (value: number) => formatCurrency(value, { currency: lcyCurrency })

  const agedAPTooltipProps = useMemo(() => {
    if (sortedAgedPayables.length === 0) return undefined
    const totalAP = agedPayablesTotal
      ? Math.abs(agedPayablesTotal.balanceDue || 0)
      : sortedAgedPayables.reduce((s: number, ap: any) => s + Math.abs(ap.balanceDue || 0), 0)
    const overdue = agedPayablesTotal
      ? Math.abs(agedPayablesTotal.period1Amount || 0) +
        Math.abs(agedPayablesTotal.period2Amount || 0) +
        Math.abs(agedPayablesTotal.period3Amount || 0)
      : sortedAgedPayables.reduce(
          (s: number, ap: any) =>
            s +
            Math.abs(ap.period1Amount || 0) +
            Math.abs(ap.period2Amount || 0) +
            Math.abs(ap.period3Amount || 0),
          0
        )
    return {
      description: `Accounts payable broken down by aging bucket per vendor. All amounts are in ${lcyCurrency} (LCY) as converted by Business Central.`,
      calculationTooltip: {
        formula: `Total AP (${lcyCurrency}) from BC agedAccountsPayables report`,
        components: [
          { label: 'Vendors with balance', value: sortedAgedPayables.length.toString() },
          {
            label: `Total AP (${lcyCurrency})`,
            value: formatCompactCurrency(totalAP, lcyCurrency),
            highlight: true,
          },
          { label: 'Overdue (past due)', value: formatCompactCurrency(overdue, lcyCurrency) },
        ],
      },
      note: `Source: BC agedAccountsPayables API. All amounts converted to ${lcyCurrency} (LCY) by Business Central. BC API provides 3 aging periods (30-day each); the last column is 61+ days (catch-all).`,
    }
  }, [sortedAgedPayables, agedPayablesTotal, lcyCurrency])

  const allVendorsTooltipProps = useMemo(() => {
    if (vendors.length === 0) return undefined
    // Collect unique currencies used by vendors
    const currenciesUsed = new Set<string>()
    vendors.forEach((v: any) => {
      if (v.balance && Math.abs(v.balance) > 0) {
        currenciesUsed.add(v.currencyCode || lcyCurrency)
      }
    })
    const currencyList = Array.from(currenciesUsed).sort()
    const isMultiCurrency = currencyList.length > 1
    return {
      description: `Complete vendor directory from Business Central. Each vendor's balance is shown in its own transaction currency.${isMultiCurrency ? ` Vendors use multiple currencies: ${currencyList.join(', ')}.` : ''}`,
      calculationTooltip: {
        formula: 'Individual vendor balances in their own currency',
        components: [
          { label: 'Total Vendors', value: vendors.length.toString() },
          ...(isMultiCurrency ? [{ label: 'Currencies', value: currencyList.join(', ') }] : []),
        ],
      },
      note: `Source: BC Vendors entity. Balances are in each vendor's transaction currency${isMultiCurrency ? ' (not converted to LCY)' : ''}. See Aged AP tab for LCY-converted totals.`,
    }
  }, [vendors, lcyCurrency])

  // Sorted vendors
  const sortedVendors = useMemo(() => {
    let items = [...vendors]
    if (hiddenVendors.size > 0) {
      items = items.filter((v: any) => !hiddenVendors.has(v.displayName))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (v: any) =>
          v.displayName?.toLowerCase().includes(q) ||
          v.number?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q)
      )
    }
    if (balanceFilter === 'with_balance') {
      items = items.filter((v: any) => Math.abs(v.balance || 0) > 0)
    } else if (balanceFilter === 'zero_balance') {
      items = items.filter((v: any) => Math.abs(v.balance || 0) === 0)
    }
    items.sort((a: any, b: any) => {
      const aVal = a[vendorSortKey] ?? ''
      const bVal = b[vendorSortKey] ?? ''
      if (typeof aVal === 'string') {
        return vendorSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return vendorSortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [vendors, hiddenVendors, searchQuery, balanceFilter, vendorSortKey, vendorSortDir])

  const handleVendorSort = (key: VendorSortKey) => {
    if (vendorSortKey === key) {
      setVendorSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setVendorSortKey(key)
      setVendorSortDir(
        key === 'displayName' || key === 'number' || key === 'email' ? 'asc' : 'desc'
      )
    }
  }

  const handleAPSort = (key: APSortKey) => {
    if (apSortKey === key) {
      setAPSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setAPSortKey(key)
      setAPSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const VendorSortIcon = ({ col }: { col: VendorSortKey }) => {
    if (vendorSortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return vendorSortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const APSortIcon = ({ col }: { col: APSortKey }) => {
    if (apSortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return apSortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  // PDF download handler
  const handleDownloadPDF = useCallback(async () => {
    if (vendors.length === 0 && agedPayables.length === 0) return
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <BCVendorsPDF
          vendors={vendors}
          agedPayables={agedPayables}
          summary={summary}
          companyName={companyName}
          currency={lcyCurrency}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vendors-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [vendors, agedPayables, summary, companyName, lcyCurrency])

  const handleDownloadCSV = useCallback(() => {
    const escapeCSV = (val: any) => {
      const s = String(val ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const today = new Date().toISOString().split('T')[0]
    const lines: string[] = []

    if (activeTab === 'aged') {
      // Report header
      if (companyName) lines.push(escapeCSV(companyName))
      lines.push('Aged Accounts Payable')
      const asOfDate = sortedAgedPayables[0]?.agedAsOfDate || today
      lines.push(`As of ${asOfDate}`)
      lines.push('')

      const headers = [
        'Vendor',
        'Number',
        'Balance Due',
        'Current',
        '1-30 Days',
        '31-60 Days',
        '61+ Days',
      ]
      lines.push(headers.join(','))

      for (const ap of sortedAgedPayables) {
        lines.push(
          [
            escapeCSV(ap.name),
            escapeCSV(ap.vendorNumber),
            ap.balanceDue ?? 0,
            ap.currentAmount ?? 0,
            ap.period1Amount ?? 0,
            ap.period2Amount ?? 0,
            ap.period3Amount ?? 0,
          ].join(',')
        )
      }

      // Totals row
      if (agedPayablesTotal) {
        lines.push(
          [
            'TOTAL',
            '',
            agedPayablesTotal.balanceDue ?? 0,
            agedPayablesTotal.currentAmount ?? 0,
            agedPayablesTotal.period1Amount ?? 0,
            agedPayablesTotal.period2Amount ?? 0,
            agedPayablesTotal.period3Amount ?? 0,
          ].join(',')
        )
      }

      lines.push('')
      lines.push(`${sortedAgedPayables.length} vendors with outstanding balances`)

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aged-payables-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      // Report header
      if (companyName) lines.push(escapeCSV(companyName))
      lines.push('Vendor Directory')
      lines.push(`Generated ${today}`)
      lines.push('')

      const headers = ['Name', 'Number', 'Email', 'Phone', 'Balance']
      lines.push(headers.join(','))

      for (const v of sortedVendors) {
        lines.push(
          [
            escapeCSV(v.displayName),
            escapeCSV(v.number),
            escapeCSV(v.email),
            escapeCSV(v.phoneNumber),
            v.balance ?? 0,
          ].join(',')
        )
      }

      // Summary
      lines.push('')
      const totalBalance = sortedVendors.reduce((s: number, v: any) => s + (v.balance || 0), 0)
      lines.push(`${sortedVendors.length} vendors,,,,, ${totalBalance}`)

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vendors-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [activeTab, sortedAgedPayables, sortedVendors, lcyCurrency, companyName, agedPayablesTotal])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load vendor data.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const sectionHover = cn('group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6 rounded-[4px]')

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Vendors
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80 mt-2">
              Business Central
            </p>
          </div>
          <div className="flex items-center gap-3">
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

      {/* Key metrics strip */}
      {summary ? (
        <div
          className={cn(
            'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
            styles.border
          )}
        >
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total Vendors
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {summary.vendorCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total AP{lcyCurrencyCode ? ` (${lcyCurrencyCode})` : ''}
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-red">
              {formatCompactCurrency(summary.totalAP, lcyCurrency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              With Balance
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {summary.vendorsWithBalance.toLocaleString()}
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div
          className={cn(
            'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
            styles.border
          )}
        >
          {['Total Vendors', 'Total AP', 'With Balance'].map((label) => (
            <div key={label}>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                {label}
              </div>
              <div
                className={cn(
                  'h-[34px] w-20 animate-pulse',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Tab navigation */}
      <div className="pt-6">
        <div
          className={cn(
            'flex items-end gap-0 shadow-sm',
            isLight ? 'shadow-stone-200/50' : 'shadow-black/20'
          )}
        >
          {sortedAgedPayables.length > 0 && (
            <button
              onClick={() => setActiveTab('aged')}
              className={cn(
                'px-5 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors',
                activeTab === 'aged'
                  ? cn(
                      styles.text,
                      isLight
                        ? 'bg-stone-200/80 border-b-2 border-amber-500'
                        : 'bg-white/[0.08] border-b-2 border-amber-500'
                    )
                  : cn(
                      styles.textMuted,
                      isLight
                        ? 'bg-stone-100/50 border-b-2 border-transparent hover:bg-stone-200/50 hover:text-stone-700'
                        : 'bg-white/[0.03] border-b-2 border-transparent hover:bg-white/[0.06] hover:text-stone-300'
                    )
              )}
            >
              Aged Accounts Payable
              {agedAPTooltipProps && (
                <span className="inline-block ml-1.5 align-middle">
                  <InfoTooltip {...agedAPTooltipProps} />
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('vendors')}
            className={cn(
              'px-5 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors',
              activeTab === 'vendors'
                ? cn(
                    styles.text,
                    isLight
                      ? 'bg-stone-200/80 border-b-2 border-amber-500'
                      : 'bg-white/[0.08] border-b-2 border-amber-500'
                  )
                : cn(
                    styles.textMuted,
                    isLight
                      ? 'bg-stone-100/50 border-b-2 border-transparent hover:bg-stone-200/50 hover:text-stone-700'
                      : 'bg-white/[0.03] border-b-2 border-transparent hover:bg-white/[0.06] hover:text-stone-300'
                  )
            )}
          >
            All Vendors
            {allVendorsTooltipProps && (
              <span className="inline-block ml-1.5 align-middle">
                <InfoTooltip {...allVendorsTooltipProps} />
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="pt-6">
          {/* Aged Payables */}
          {activeTab === 'aged' && sortedAgedPayables.length > 0 && (
            <section className={cn(sectionHover)}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search
                    className={cn(
                      'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                      styles.textMuted
                    )}
                  />
                  <input
                    type="text"
                    placeholder="Search by vendor name or number..."
                    value={agedSearchQuery}
                    onChange={(e) => setAgedSearchQuery(e.target.value)}
                    className={cn(
                      'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                      'border bg-transparent',
                      styles.border,
                      styles.text,
                      'placeholder:text-stone-400',
                      'focus:border-amber-500/40'
                    )}
                  />
                </div>
                <Popover onOpenChange={() => setFilterSearch('')}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm transition-colors',
                        'border bg-transparent cursor-pointer select-none',
                        styles.border,
                        hiddenVendors.size > 0
                          ? 'border-amber-500/40 text-amber-500'
                          : cn(styles.textMuted, 'hover:text-amber-500')
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {hiddenVendors.size > 0 ? `${hiddenVendors.size} hidden` : 'Filter'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div
                      className="p-3 border-b"
                      style={{ borderColor: 'var(--theme-glass-border)' }}
                    >
                      {hiddenVendors.size > 0 && (
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => setHiddenVendors(new Set())}
                            className="text-xs text-amber-500 hover:text-amber-400"
                          >
                            Show all
                          </button>
                        </div>
                      )}
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className={cn(
                            'w-full h-8 pl-7 pr-2 rounded text-xs focus:outline-none',
                            'border bg-transparent',
                            styles.border,
                            styles.text,
                            'placeholder:text-stone-400'
                          )}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {allVendorNames
                        .filter((name) =>
                          filterSearch
                            ? name.toLowerCase().includes(filterSearch.toLowerCase())
                            : true
                        )
                        .map((name) => {
                          const isHidden = hiddenVendors.has(name)
                          return (
                            <button
                              key={name}
                              onClick={() => {
                                setHiddenVendors((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(name)) next.delete(name)
                                  else next.add(name)
                                  return next
                                })
                              }}
                              className={cn(
                                'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left transition-colors',
                                'hover:bg-stone-500/10',
                                isHidden && 'opacity-50'
                              )}
                            >
                              {isHidden ? (
                                <EyeOff className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              )}
                              <span className="truncate">{name}</span>
                            </button>
                          )
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu
                  align="end"
                  trigger={
                    <button
                      className={cn(
                        'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm transition-colors',
                        'border bg-transparent cursor-pointer select-none',
                        styles.border,
                        styles.textMuted,
                        'hover:text-amber-500'
                      )}
                    >
                      {isDownloadingPDF ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Export
                    </button>
                  }
                >
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={handleDownloadPDF}
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    <span>Export as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={handleDownloadCSV}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-500" />
                    <span>Export as CSV</span>
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn('border-b', styles.border)}>
                      <th
                        className={cn(
                          'text-left py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleAPSort('name')}
                          className="flex items-center gap-1 cursor-pointer select-none"
                        >
                          Vendor <APSortIcon col="name" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleAPSort('balanceDue')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          Balance <APSortIcon col="balanceDue" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleAPSort('currentAmount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          Current <APSortIcon col="currentAmount" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleAPSort('period1Amount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          1-30 <APSortIcon col="period1Amount" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleAPSort('period2Amount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          31-60 <APSortIcon col="period2Amount" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleAPSort('period3Amount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          61+ <APSortIcon col="period3Amount" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgedPayables.map((ap: any, i: number) => {
                      const balance = ap.balanceDue || 0
                      const current = ap.currentAmount || 0
                      const p1 = ap.period1Amount || 0
                      const p2 = ap.period2Amount || 0
                      const p3 = ap.period3Amount || 0
                      const maxBucket = Math.max(
                        Math.abs(current),
                        Math.abs(p1),
                        Math.abs(p2),
                        Math.abs(p3)
                      )
                      const highlightColor = (val: number) => {
                        if (Math.abs(val) === 0) return styles.textMuted
                        if (Math.abs(val) === maxBucket && maxBucket > 0) {
                          if (val === current)
                            return isLight ? 'text-emerald-600' : 'text-emerald-400'
                          if (val === p3) return isLight ? 'text-red-600' : 'text-red-400'
                          return isLight ? 'text-amber-600' : 'text-amber-400'
                        }
                        return styles.text
                      }
                      return (
                        <React.Fragment key={ap.vendorId || i}>
                          <tr
                            onClick={() =>
                              ap.vendorId &&
                              setSelectedVendorId((prev) =>
                                prev === ap.vendorId ? null : ap.vendorId
                              )
                            }
                            className={cn(
                              'transition-colors cursor-pointer',
                              i % 2 === 0 ? (isLight ? 'bg-stone-100/80' : 'bg-white/[0.02]') : '',
                              isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]'
                            )}
                          >
                            <td
                              className={cn(
                                'py-2 px-2 font-medium max-w-[180px] truncate',
                                styles.text
                              )}
                              title={ap.name}
                            >
                              <span className="flex items-center gap-1.5">
                                {selectedVendorId === ap.vendorId ? (
                                  <ChevronDown className="w-3 h-3 shrink-0 theme-text-secondary" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                )}
                                {ap.name}
                              </span>
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                                styles.text
                              )}
                            >
                              {formatAged(balance)}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                                highlightColor(current)
                              )}
                            >
                              {formatAged(current)}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                                highlightColor(p1)
                              )}
                            >
                              {formatAged(p1)}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                                highlightColor(p2)
                              )}
                            >
                              {formatAged(p2)}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums font-medium whitespace-nowrap',
                                highlightColor(p3)
                              )}
                            >
                              {formatAged(p3)}
                            </td>
                          </tr>
                          {selectedVendorId === ap.vendorId && (
                            <tr>
                              <td colSpan={6} className="p-0 border-none">
                                <BCVendorDetailView
                                  connectionId={connectionId}
                                  vendorId={ap.vendorId}
                                  inline
                                  onClose={() => setSelectedVendorId(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  {/* Total row from BC's authoritative Total record */}
                  {agedPayablesTotal && (
                    <tfoot>
                      <tr
                        className={cn(
                          'border-t-2',
                          isLight ? 'border-stone-300' : 'border-white/[0.15]'
                        )}
                      >
                        <td
                          className={cn(
                            'py-2.5 px-2 font-semibold text-xs uppercase tracking-wider',
                            styles.textMuted
                          )}
                        >
                          Total{lcyCurrencyCode ? ` (${lcyCurrencyCode})` : ' (LCY)'}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedPayablesTotal.balanceDue)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedPayablesTotal.currentAmount)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedPayablesTotal.period1Amount)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedPayablesTotal.period2Amount)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            Math.abs(agedPayablesTotal.period3Amount || 0) > 0
                              ? isLight
                                ? 'text-red-600'
                                : 'text-red-400'
                              : styles.text
                          )}
                        >
                          {formatAged(agedPayablesTotal.period3Amount)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className={cn('text-[10px] mt-2 pt-2 border-t', styles.border, styles.textMuted)}>
                {sortedAgedPayables.length} vendors with outstanding balances &middot; Amounts in{' '}
                {lcyCurrencyCode ? `${lcyCurrencyCode} (LCY)` : 'LCY'} &middot; 61+ = all invoices
                &ge;61 days overdue
              </p>
            </section>
          )}

          {/* Vendor List */}
          {activeTab === 'vendors' && (
            <section className={cn(sectionHover)}>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search
                    className={cn(
                      'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                      styles.textMuted
                    )}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, number, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                      'border bg-transparent',
                      styles.border,
                      styles.text,
                      'placeholder:text-stone-400',
                      'focus:border-amber-500/40'
                    )}
                  />
                </div>
                <Select value={balanceFilter} onValueChange={setBalanceFilter}>
                  <SelectTrigger className={cn('w-[150px] h-9 text-sm border', styles.border)}>
                    <SelectValue placeholder="Balance" />
                  </SelectTrigger>
                  <SelectContent className="glass-luxury-card">
                    <SelectItem value="all">All Vendors</SelectItem>
                    <SelectItem value="with_balance">With Balance</SelectItem>
                    <SelectItem value="zero_balance">Zero Balance</SelectItem>
                  </SelectContent>
                </Select>
                <Popover onOpenChange={() => setFilterSearch('')}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm transition-colors',
                        'border bg-transparent cursor-pointer select-none',
                        styles.border,
                        hiddenVendors.size > 0
                          ? 'border-amber-500/40 text-amber-500'
                          : cn(styles.textMuted, 'hover:text-amber-500')
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {hiddenVendors.size > 0 ? `${hiddenVendors.size} hidden` : 'Filter'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div
                      className="p-3 border-b"
                      style={{ borderColor: 'var(--theme-glass-border)' }}
                    >
                      {hiddenVendors.size > 0 && (
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => setHiddenVendors(new Set())}
                            className="text-xs text-amber-500 hover:text-amber-400"
                          >
                            Show all
                          </button>
                        </div>
                      )}
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className={cn(
                            'w-full h-8 pl-7 pr-2 rounded text-xs focus:outline-none',
                            'border bg-transparent',
                            styles.border,
                            styles.text,
                            'placeholder:text-stone-400'
                          )}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {allVendorNames
                        .filter((name) =>
                          filterSearch
                            ? name.toLowerCase().includes(filterSearch.toLowerCase())
                            : true
                        )
                        .map((name) => {
                          const isHidden = hiddenVendors.has(name)
                          return (
                            <button
                              key={name}
                              onClick={() => {
                                setHiddenVendors((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(name)) next.delete(name)
                                  else next.add(name)
                                  return next
                                })
                              }}
                              className={cn(
                                'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left transition-colors',
                                'hover:bg-stone-500/10',
                                isHidden && 'opacity-50'
                              )}
                            >
                              {isHidden ? (
                                <EyeOff className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              )}
                              <span className="truncate">{name}</span>
                            </button>
                          )
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu
                  align="end"
                  trigger={
                    <button
                      className={cn(
                        'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm transition-colors',
                        'border bg-transparent cursor-pointer select-none',
                        styles.border,
                        styles.textMuted,
                        'hover:text-amber-500'
                      )}
                    >
                      {isDownloadingPDF ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Export
                    </button>
                  }
                >
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={handleDownloadPDF}
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    <span>Export as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={handleDownloadCSV}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-500" />
                    <span>Export as CSV</span>
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>
              {isLoading ? (
                <div>
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-10 animate-pulse',
                        i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : ''
                      )}
                    />
                  ))}
                </div>
              ) : sortedVendors.length > 0 ? (
                <>
                  {/* Header row */}
                  <div
                    className={cn(
                      'flex items-center gap-3 py-2 px-3 text-sm border-b mb-0.5',
                      styles.border
                    )}
                  >
                    <button
                      onClick={() => handleVendorSort('displayName')}
                      className={cn(
                        'flex-1 flex items-center gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Name <VendorSortIcon col="displayName" />
                    </button>
                    <button
                      onClick={() => handleVendorSort('number')}
                      className={cn(
                        'w-24 flex items-center gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Number <VendorSortIcon col="number" />
                    </button>
                    <button
                      onClick={() => handleVendorSort('email')}
                      className={cn(
                        'w-48 hidden @xl:flex items-center gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Email <VendorSortIcon col="email" />
                    </button>
                    <button
                      onClick={() => handleVendorSort('balance')}
                      className={cn(
                        'w-28 flex items-center justify-end gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Balance <VendorSortIcon col="balance" />
                    </button>
                  </div>

                  {/* Data rows */}
                  <div
                    className="max-h-[600px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                    }}
                  >
                    {sortedVendors.map((vendor: any, i: number) => (
                      <React.Fragment key={vendor.id || i}>
                        <div
                          onClick={() =>
                            vendor.id &&
                            setSelectedVendorId((prev) => (prev === vendor.id ? null : vendor.id))
                          }
                          className={cn(
                            'flex items-center gap-3 py-2.5 px-3 text-sm transition-colors cursor-pointer',
                            i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                            isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                          )}
                        >
                          <span
                            className={cn(
                              'flex-1 truncate font-medium inline-flex items-center gap-1.5',
                              styles.text
                            )}
                            title={vendor.displayName}
                          >
                            {selectedVendorId === vendor.id ? (
                              <ChevronDown className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            ) : (
                              <ChevronRight className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            )}
                            {vendor.displayName}
                          </span>
                          <span className={cn('w-24 font-mono text-sm', styles.textMuted)}>
                            {vendor.number}
                          </span>
                          <span
                            className={cn(
                              'w-48 truncate text-sm hidden @xl:block',
                              styles.textMuted
                            )}
                            title={vendor.email}
                          >
                            {vendor.email || '—'}
                          </span>
                          <span
                            className={cn(
                              'w-28 text-right font-mono tabular-nums font-semibold',
                              styles.text
                            )}
                          >
                            {formatCompactCurrency(
                              vendor.balance || 0,
                              vendor.currencyCode || lcyCurrency
                            )}
                            {vendor.currencyCode && vendor.currencyCode !== lcyCurrency && (
                              <span
                                className={cn('ml-1 text-[10px] font-normal', styles.textMuted)}
                              >
                                {vendor.currencyCode}
                              </span>
                            )}
                          </span>
                        </div>
                        {selectedVendorId === vendor.id && (
                          <BCVendorDetailView
                            connectionId={connectionId}
                            vendorId={vendor.id}
                            inline
                            onClose={() => setSelectedVendorId(null)}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              ) : (
                <p className={cn('text-sm py-4', styles.textMuted)}>
                  {vendors.length > 0
                    ? 'No vendors match your filters'
                    : 'No vendor data available'}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
