'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useBCCustomers } from '../../hooks/useBCCustomers'
import { useBCSalesByCustomer } from '../../hooks/useBCSalesByCustomer'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils/currency'
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
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
import { useRouter, useSearchParams } from 'next/navigation'
import { pdf } from '@react-pdf/renderer'
import { BCCustomersPDF } from '../components'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { BCCustomerDetailView } from '../[customerId]/views/BCCustomerDetailView'

type CustomerSortKey = 'displayName' | 'number' | 'email' | 'balanceDue'
type ARSortKey =
  | 'name'
  | 'balanceDue'
  | 'currentAmount'
  | 'period1Amount'
  | 'period2Amount'
  | 'period3Amount'
type SortDir = 'asc' | 'desc'

export function BCOAuthCustomersView({ connectionId }: { connectionId: string }) {
  const {
    customers,
    agedReceivables,
    agedReceivablesTotal,
    summary,
    companyName,
    isLoading,
    error,
    mutate,
  } = useBCCustomers(connectionId)

  // Sales by customer — all time (no date filter), for per-customer breakdown
  const { summary: salesSummary, customers: salesCustomers } = useBCSalesByCustomer(connectionId)

  // Merge sales data into customer list for per-customer revenue
  const salesByNumber = useMemo(() => {
    const map = new Map<string, { totalSales: number; netSales: number; invoiceCount: number }>()
    for (const sc of salesCustomers) {
      map.set(sc.customerNumber, {
        totalSales: sc.totalSales,
        netSales: sc.netSales,
        invoiceCount: sc.invoiceCount,
      })
    }
    return map
  }, [salesCustomers])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const router = useRouter()
  const searchParams = useSearchParams()

  // Build a query string that preserves connectionId (and any other params) for sub-navigation
  const detailQueryString = useMemo(() => {
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.set(key, value)
    })
    if (!params.has('connectionId') && connectionId) {
      params.set('connectionId', connectionId)
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [searchParams, connectionId])

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)
  const [activeTab, setActiveTab] = useState<'customers' | 'aged'>('aged')
  const [searchQuery, setSearchQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState('all')
  const [customerSortKey, setCustomerSortKey] = useState<CustomerSortKey>('displayName')
  const [customerSortDir, setCustomerSortDir] = useState<SortDir>('asc')
  const [arSortKey, setARSortKey] = useState<ARSortKey>('balanceDue')
  const [arSortDir, setARSortDir] = useState<SortDir>('desc')

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
    const hasData = customers.length > 0 || !!summary
    const allDoneLoading = !isLoading
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [welcomeContext, isLoading, customers.length, summary])

  const currency = 'USD'

  const [agedSearchQuery, setAgedSearchQuery] = useState('')
  const [hiddenCustomers, setHiddenCustomers] = useState<Set<string>>(new Set())
  const [filterSearch, setFilterSearch] = useState('')

  // All unique customer names for the filter popover
  const allCustomerNames = useMemo(() => {
    const names = new Set<string>()
    customers.forEach((c: any) => {
      if (c.displayName) names.add(c.displayName)
    })
    agedReceivables.forEach((ar: any) => {
      if (ar.name) names.add(ar.name)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [customers, agedReceivables])

  // Sort aged receivables by user-selected key, filter to only those with a balance
  const sortedAgedReceivables = useMemo(() => {
    let items = agedReceivables.filter((ar: any) => Math.abs(ar.balanceDue || 0) > 0)
    if (hiddenCustomers.size > 0) {
      items = items.filter((ar: any) => !hiddenCustomers.has(ar.name))
    }
    if (agedSearchQuery) {
      const q = agedSearchQuery.toLowerCase()
      items = items.filter(
        (ar: any) =>
          ar.name?.toLowerCase().includes(q) || ar.customerNumber?.toLowerCase().includes(q)
      )
    }
    items.sort((a: any, b: any) => {
      const aVal = a[arSortKey] ?? ''
      const bVal = b[arSortKey] ?? ''
      if (typeof aVal === 'string') {
        return arSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return arSortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [agedReceivables, hiddenCustomers, agedSearchQuery, arSortKey, arSortDir])

  const filteredCustomers = useMemo(() => {
    let items = [...customers]
    if (hiddenCustomers.size > 0) {
      items = items.filter((c: any) => !hiddenCustomers.has(c.displayName))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (c: any) =>
          c.displayName?.toLowerCase().includes(q) ||
          c.number?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    }
    if (balanceFilter === 'with_balance') {
      items = items.filter((c: any) => Math.abs(c.balanceDue || 0) > 0)
    } else if (balanceFilter === 'zero_balance') {
      items = items.filter((c: any) => Math.abs(c.balanceDue || 0) === 0)
    }
    items.sort((a: any, b: any) => {
      const aVal = a[customerSortKey] ?? ''
      const bVal = b[customerSortKey] ?? ''
      if (typeof aVal === 'string') {
        return customerSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return customerSortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [customers, hiddenCustomers, searchQuery, balanceFilter, customerSortKey, customerSortDir])

  const formatAged = (value: number) => formatCurrency(value, { currency })

  const handleCustomerSort = (key: CustomerSortKey) => {
    if (customerSortKey === key) {
      setCustomerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setCustomerSortKey(key)
      setCustomerSortDir(
        key === 'displayName' || key === 'number' || key === 'email' ? 'asc' : 'desc'
      )
    }
  }

  const handleARSort = (key: ARSortKey) => {
    if (arSortKey === key) {
      setARSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setARSortKey(key)
      setARSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const CustomerSortIcon = ({ col }: { col: CustomerSortKey }) => {
    if (customerSortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return customerSortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const ARSortIcon = ({ col }: { col: ARSortKey }) => {
    if (arSortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return arSortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const agedARTooltipProps = useMemo(() => {
    if (sortedAgedReceivables.length === 0) return undefined
    const totalAR =
      agedReceivablesTotal?.balanceDue ??
      sortedAgedReceivables.reduce((s: number, ar: any) => s + (ar.balanceDue || 0), 0)
    const overdue = agedReceivablesTotal
      ? (agedReceivablesTotal.period1Amount || 0) +
        (agedReceivablesTotal.period2Amount || 0) +
        (agedReceivablesTotal.period3Amount || 0)
      : sortedAgedReceivables.reduce(
          (s: number, ar: any) =>
            s + (ar.period1Amount || 0) + (ar.period2Amount || 0) + (ar.period3Amount || 0),
          0
        )
    return {
      description:
        'Accounts receivable broken down by aging bucket per customer. All amounts are in Local Currency (LCY) as converted by Business Central.',
      calculationTooltip: {
        formula: 'Total AR (LCY) from BC agedAccountsReceivables report',
        components: [
          { label: 'Customers with balance', value: sortedAgedReceivables.length.toString() },
          {
            label: 'Total AR (LCY)',
            value: formatCompactCurrency(totalAR, currency),
            highlight: true,
          },
          { label: 'Overdue (past due)', value: formatCompactCurrency(overdue, currency) },
        ],
      },
      note: 'Source: BC agedAccountsReceivables API (LCY). BC API provides 3 aging periods (30-day each); the last column is 61+ days (catch-all).',
    }
  }, [sortedAgedReceivables, agedReceivablesTotal, currency])

  const allCustomersTooltipProps = useMemo(() => {
    if (customers.length === 0) return undefined
    const totalBalance = customers.reduce((s: number, c: any) => s + (c.balanceDue || 0), 0)
    return {
      description: 'Complete customer directory from Business Central with current balance due.',
      calculationTooltip: {
        formula: 'Total Balance = Σ Customer Balance Due',
        components: [
          { label: 'Total Customers', value: customers.length.toString() },
          {
            label: 'Total Balance Due',
            value: formatCompactCurrency(totalBalance, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Customers entity. Balance reflects outstanding receivables.',
    }
  }, [customers, currency])

  const handleDownloadPDF = useCallback(async () => {
    if (customers.length === 0 && agedReceivables.length === 0) return
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <BCCustomersPDF
          customers={customers}
          agedReceivables={agedReceivables}
          summary={summary}
          companyName={companyName}
          currency={currency}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [customers, agedReceivables, summary, companyName, currency])

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
      lines.push('Aged Accounts Receivable')
      const asOfDate = sortedAgedReceivables[0]?.agedAsOfDate || today
      lines.push(`As of ${asOfDate}`)
      lines.push('')

      // Use period labels from BC if available, fallback to generic
      const first = sortedAgedReceivables[0]
      const p1Label = first?.period1Label || '1-30 Days'
      const p2Label = first?.period2Label || '31-60 Days'
      const p3Label = first?.period3Label || '61+ Days'

      const headers = ['Customer', 'Number', 'Balance Due', 'Current', p1Label, p2Label, p3Label]
      lines.push(headers.join(','))

      for (const ar of sortedAgedReceivables) {
        lines.push(
          [
            escapeCSV(ar.name),
            escapeCSV(ar.customerNumber),
            ar.balanceDue ?? 0,
            ar.currentAmount ?? 0,
            ar.period1Amount ?? 0,
            ar.period2Amount ?? 0,
            ar.period3Amount ?? 0,
          ].join(',')
        )
      }

      // Totals row
      if (agedReceivablesTotal) {
        lines.push(
          [
            'TOTAL',
            '',
            agedReceivablesTotal.balanceDue ?? 0,
            agedReceivablesTotal.currentAmount ?? 0,
            agedReceivablesTotal.period1Amount ?? 0,
            agedReceivablesTotal.period2Amount ?? 0,
            agedReceivablesTotal.period3Amount ?? 0,
          ].join(',')
        )
      }

      lines.push('')
      lines.push(`${sortedAgedReceivables.length} customers with outstanding balances`)

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aged-receivables-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      // Report header
      if (companyName) lines.push(escapeCSV(companyName))
      lines.push('Customer Directory')
      lines.push(`Generated ${today}`)
      lines.push('')

      const headers = [
        'Name',
        'Number',
        'Email',
        'Phone',
        'Balance Due',
        'Credit Limit',
        'Revenue',
        'Net Sales',
        'Invoices',
      ]
      lines.push(headers.join(','))

      for (const c of filteredCustomers) {
        const sales = salesByNumber.get(c.number)
        lines.push(
          [
            escapeCSV(c.displayName),
            escapeCSV(c.number),
            escapeCSV(c.email),
            escapeCSV(c.phoneNumber),
            c.balanceDue ?? 0,
            c.creditLimit ?? 0,
            sales?.totalSales ?? 0,
            sales?.netSales ?? 0,
            sales?.invoiceCount ?? 0,
          ].join(',')
        )
      }

      // Summary row
      lines.push('')
      const totalBalance = filteredCustomers.reduce(
        (s: number, c: any) => s + (c.balanceDue || 0),
        0
      )
      lines.push(`${filteredCustomers.length} customers,,,,,${totalBalance}`)

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [
    activeTab,
    sortedAgedReceivables,
    filteredCustomers,
    salesByNumber,
    companyName,
    currency,
    agedReceivablesTotal,
  ])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load customer data.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const sectionHover = ''

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
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Customers
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
              Total Customers
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {summary.customerCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total AR
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-green">
              {formatCompactCurrency(summary.totalAR, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              With Balance
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {summary.customersWithBalance.toLocaleString()}
            </div>
          </div>
          {salesSummary ? (
            <>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Total Invoices
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {salesSummary.totalInvoices.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Credit Memos
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {salesSummary.totalCreditMemos.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Total Sales Invoice
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {formatCompactCurrency(salesSummary.totalSales, currency)}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Returns
                </div>
                <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-red">
                  {formatCompactCurrency(salesSummary.totalReturns, currency)}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Net Sales
                </div>
                <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-green">
                  {formatCompactCurrency(salesSummary.netSales, currency)}
                </div>
              </div>
            </>
          ) : (
            <>
              {[
                'Total Invoices',
                'Credit Memos',
                'Total Sales Invoice',
                'Returns',
                'Net Sales',
              ].map((label) => (
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
            </>
          )}
        </div>
      ) : isLoading ? (
        <div
          className={cn(
            'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
            styles.border
          )}
        >
          {[
            'Total Customers',
            'Total AR',
            'With Balance',
            'Total Invoices',
            'Credit Memos',
            'Total Sales Invoice',
            'Returns',
            'Net Sales',
          ].map((label) => (
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
          {sortedAgedReceivables.length > 0 && (
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
              Aged Accounts Receivable
              {agedARTooltipProps && (
                <span className="inline-block ml-1.5 align-middle">
                  <InfoTooltip {...agedARTooltipProps} />
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('customers')}
            className={cn(
              'px-5 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors',
              activeTab === 'customers'
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
            All Customers
            {allCustomersTooltipProps && (
              <span className="inline-block ml-1.5 align-middle">
                <InfoTooltip {...allCustomersTooltipProps} />
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="pt-6">
          {/* Customer List */}
          {activeTab === 'customers' && (
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
                    <SelectItem value="all">All Customers</SelectItem>
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
                        hiddenCustomers.size > 0
                          ? 'border-amber-500/40 text-amber-500'
                          : cn(styles.textMuted, 'hover:text-amber-500')
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {hiddenCustomers.size > 0 ? `${hiddenCustomers.size} hidden` : 'Filter'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div
                      className="p-3 border-b"
                      style={{ borderColor: 'var(--theme-glass-border)' }}
                    >
                      {hiddenCustomers.size > 0 && (
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => setHiddenCustomers(new Set())}
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
                      {allCustomerNames
                        .filter((name) =>
                          filterSearch
                            ? name.toLowerCase().includes(filterSearch.toLowerCase())
                            : true
                        )
                        .map((name) => {
                          const isHidden = hiddenCustomers.has(name)
                          return (
                            <button
                              key={name}
                              onClick={() => {
                                setHiddenCustomers((prev) => {
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
              ) : filteredCustomers.length > 0 ? (
                <>
                  {/* Header row */}
                  <div
                    className={cn(
                      'flex items-center gap-3 py-2 px-3 text-sm border-b mb-0.5',
                      styles.border
                    )}
                  >
                    <button
                      onClick={() => handleCustomerSort('displayName')}
                      className={cn(
                        'flex-1 flex items-center gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Name <CustomerSortIcon col="displayName" />
                    </button>
                    <button
                      onClick={() => handleCustomerSort('number')}
                      className={cn(
                        'w-24 flex items-center gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Number <CustomerSortIcon col="number" />
                    </button>
                    <button
                      onClick={() => handleCustomerSort('email')}
                      className={cn(
                        'w-48 hidden @xl:flex items-center gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Email <CustomerSortIcon col="email" />
                    </button>
                    <button
                      onClick={() => handleCustomerSort('balanceDue')}
                      className={cn(
                        'w-24 flex items-center justify-end gap-1 font-medium cursor-pointer select-none',
                        styles.textMuted
                      )}
                    >
                      Balance <CustomerSortIcon col="balanceDue" />
                    </button>
                    <span
                      className={cn(
                        'w-28 text-right font-medium hidden @lg:block',
                        styles.textMuted
                      )}
                    >
                      Revenue
                    </span>
                    <span
                      className={cn(
                        'w-28 text-right font-medium hidden @lg:block',
                        styles.textMuted
                      )}
                    >
                      Net Sales
                    </span>
                  </div>

                  {/* Data rows */}
                  <div
                    className="max-h-[600px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                    }}
                  >
                    {filteredCustomers.map((customer: any, i: number) => (
                      <React.Fragment key={customer.id || i}>
                        <div
                          onClick={() =>
                            setSelectedCustomerId((prev) =>
                              prev === customer.id ? null : customer.id
                            )
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
                            title={customer.displayName}
                          >
                            {selectedCustomerId === customer.id ? (
                              <ChevronDown className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            ) : (
                              <ChevronRight className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            )}
                            {customer.displayName}
                          </span>
                          <span className={cn('w-24 font-mono text-sm', styles.textMuted)}>
                            {customer.number}
                          </span>
                          <span
                            className={cn(
                              'w-48 truncate text-sm hidden @xl:block',
                              styles.textMuted
                            )}
                            title={customer.email}
                          >
                            {customer.email || '—'}
                          </span>
                          <span
                            className={cn(
                              'w-24 text-right font-mono tabular-nums font-semibold',
                              styles.text
                            )}
                          >
                            {formatCompactCurrency(customer.balanceDue || 0, currency)}
                          </span>
                          <span
                            className={cn(
                              'w-28 text-right font-mono tabular-nums text-sm hidden @lg:block',
                              styles.textMuted
                            )}
                          >
                            {formatCompactCurrency(
                              salesByNumber.get(customer.number)?.totalSales ?? 0,
                              currency
                            )}
                          </span>
                          <span
                            className={cn(
                              'w-28 text-right font-mono tabular-nums text-sm hidden @lg:block',
                              styles.textMuted
                            )}
                          >
                            {formatCompactCurrency(
                              salesByNumber.get(customer.number)?.netSales ?? 0,
                              currency
                            )}
                          </span>
                        </div>
                        {selectedCustomerId === customer.id && (
                          <BCCustomerDetailView
                            connectionId={connectionId}
                            customerId={customer.id}
                            inline
                            onClose={() => setSelectedCustomerId(null)}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              ) : (
                <p className={cn('text-sm py-4', styles.textMuted)}>
                  {customers.length > 0
                    ? 'No customers match your filters'
                    : 'No customer data available'}
                </p>
              )}
            </section>
          )}

          {/* Aged Receivables */}
          {activeTab === 'aged' && sortedAgedReceivables.length > 0 && (
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
                    placeholder="Search by customer name or number..."
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
                        hiddenCustomers.size > 0
                          ? 'border-amber-500/40 text-amber-500'
                          : cn(styles.textMuted, 'hover:text-amber-500')
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {hiddenCustomers.size > 0 ? `${hiddenCustomers.size} hidden` : 'Filter'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div
                      className="p-3 border-b"
                      style={{ borderColor: 'var(--theme-glass-border)' }}
                    >
                      {hiddenCustomers.size > 0 && (
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => setHiddenCustomers(new Set())}
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
                      {allCustomerNames
                        .filter((name) =>
                          filterSearch
                            ? name.toLowerCase().includes(filterSearch.toLowerCase())
                            : true
                        )
                        .map((name) => {
                          const isHidden = hiddenCustomers.has(name)
                          return (
                            <button
                              key={name}
                              onClick={() => {
                                setHiddenCustomers((prev) => {
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
                          onClick={() => handleARSort('name')}
                          className="flex items-center gap-1 cursor-pointer select-none"
                        >
                          Customer <ARSortIcon col="name" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleARSort('balanceDue')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          Balance <ARSortIcon col="balanceDue" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleARSort('currentAmount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          Current <ARSortIcon col="currentAmount" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleARSort('period1Amount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          1-30 <ARSortIcon col="period1Amount" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleARSort('period2Amount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          31-60 <ARSortIcon col="period2Amount" />
                        </button>
                      </th>
                      <th
                        className={cn(
                          'text-right py-2 px-2 font-medium whitespace-nowrap',
                          styles.textMuted
                        )}
                      >
                        <button
                          onClick={() => handleARSort('period3Amount')}
                          className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                        >
                          61+ <ARSortIcon col="period3Amount" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgedReceivables.map((ar: any, i: number) => {
                      const balance = ar.balanceDue || 0
                      const current = ar.currentAmount || 0
                      const p1 = ar.period1Amount || 0
                      const p2 = ar.period2Amount || 0
                      const p3 = ar.period3Amount || 0
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
                        <React.Fragment key={ar.customerId || i}>
                          <tr
                            onClick={() =>
                              setSelectedCustomerId((prev) =>
                                prev === ar.customerId ? null : ar.customerId
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
                              title={ar.name}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {selectedCustomerId === ar.customerId ? (
                                  <ChevronDown className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                                )}
                                {ar.name}
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
                          {selectedCustomerId === ar.customerId && (
                            <tr>
                              <td colSpan={6} className="p-0 border-none">
                                <BCCustomerDetailView
                                  connectionId={connectionId}
                                  customerId={ar.customerId}
                                  inline
                                  onClose={() => setSelectedCustomerId(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  {agedReceivablesTotal && (
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
                          Total (LCY)
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedReceivablesTotal.balanceDue)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedReceivablesTotal.currentAmount)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedReceivablesTotal.period1Amount)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatAged(agedReceivablesTotal.period2Amount)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            (agedReceivablesTotal.period3Amount || 0) > 0
                              ? isLight
                                ? 'text-red-600'
                                : 'text-red-400'
                              : styles.text
                          )}
                        >
                          {formatAged(agedReceivablesTotal.period3Amount)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className={cn('text-[10px] mt-2 pt-2 border-t', styles.border, styles.textMuted)}>
                {sortedAgedReceivables.length} customers with outstanding balances &middot; Amounts
                in LCY &middot; 61+ = all invoices &ge;61 days overdue
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
