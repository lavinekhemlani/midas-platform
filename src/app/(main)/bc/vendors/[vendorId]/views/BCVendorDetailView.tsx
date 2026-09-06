'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBCVendorDetail } from '../../../hooks/useBCVendorDetail'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import {
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  ShoppingCart,
  CreditCard,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Globe,
  X,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import type {
  BCPurchaseInvoice,
  BCPurchaseOrder,
  BCPurchaseCreditMemo,
  BCPurchaseReceipt,
} from '../../../hooks/useBCVendorDetail'
import { DocumentLineItems } from '../../../components/DocumentLineItems'

type DetailTab = 'invoices' | 'orders' | 'creditMemos' | 'receipts'
type SortDir = 'asc' | 'desc'

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function StatusBadge({ status, isLight }: { status: string; isLight: boolean }) {
  const normalized = (status || '').toLowerCase().trim()
  let color = isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/[0.08] text-stone-400'

  if (normalized === 'open' || normalized === 'in review') {
    color = isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
  } else if (normalized === 'paid' || normalized === 'corrective') {
    color = isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
  } else if (normalized === 'canceled' || normalized === 'cancelled') {
    color = isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400'
  } else if (normalized === 'draft') {
    color = isLight ? 'bg-stone-100 text-stone-500' : 'bg-white/[0.05] text-stone-500'
  }

  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide',
        color
      )}
    >
      {status || 'Unknown'}
    </span>
  )
}

export function BCVendorDetailView({
  connectionId,
  vendorId,
  inline,
  onClose,
}: {
  connectionId: string
  vendorId: string
  inline?: boolean
  onClose?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Build back-link that preserves connectionId and other query params
  const vendorsListUrl = useMemo(() => {
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.set(key, value)
    })
    if (!params.has('connectionId') && connectionId) {
      params.set('connectionId', connectionId)
    }
    const qs = params.toString()
    return `/bc/vendors${qs ? `?${qs}` : ''}`
  }, [searchParams, connectionId])

  const {
    vendor,
    invoices,
    orders,
    creditMemos,
    receipts,
    agedPayable,
    lcyCurrencyCode,
    summary,
    isLoading,
    error,
    mutate,
  } = useBCVendorDetail(connectionId, vendorId)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [activeTab, setActiveTab] = useState<DetailTab>('invoices')
  const [sortKey, setSortKey] = useState<string>('postingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  const toggleRow = (id: string) => setExpandedRowId((prev) => (prev === id ? null : id))

  // BC currency rules:
  // - vendor.currencyCode empty → vendor transacts in LCY
  // - document.currencyCode empty → that document is in LCY (NOT vendor currency)
  // - vendor.balance is ALWAYS in LCY (from vendor ledger entries)
  // - agedPayable amounts are ALWAYS in LCY
  const lcyCurrency = lcyCurrencyCode || ''
  const vendorCurrency = vendor?.currencyCode || lcyCurrency // empty = LCY
  const isMultiCurrency = !!(
    lcyCurrency &&
    vendor?.currencyCode &&
    lcyCurrency !== vendor.currencyCode
  )
  // Helper: resolve a document's currency (empty = LCY, not vendor currency)
  const resolveDocCurrency = (docCurrencyCode: string | undefined | null) =>
    docCurrencyCode || lcyCurrency

  const styles = useMemo(
    () => ({
      border: 'border-[var(--theme-card-border)]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      card: isLight
        ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
        : 'bg-white/[0.02] border-[var(--theme-card-border)]',
    }),
    [isLight]
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'number' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  function sortItems<T extends Record<string, any>>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }

  const handleDownloadPDF = useCallback(async () => {
    if (!vendor) return
    setIsDownloadingPDF(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { BCVendorDetailPDF } = await import('../../../components/BCVendorDetailPDF')
      const blob = await pdf(
        <BCVendorDetailPDF
          vendor={vendor}
          invoices={invoices}
          orders={orders}
          creditMemos={creditMemos}
          receipts={receipts}
          agedPayable={agedPayable}
          lcyCurrencyCode={lcyCurrencyCode}
          summary={summary}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = vendor.displayName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)
      a.download = `vendor-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [vendor, invoices, orders, creditMemos, receipts, agedPayable, lcyCurrencyCode, summary])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load vendor detail.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading || !vendor) {
    return (
      <div className="space-y-6 max-w-[1800px] mx-auto">
        {/* Skeleton header */}
        <div className="mb-10 pt-2">
          <div
            className={cn(
              'h-4 w-20 rounded animate-pulse mb-4',
              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
            )}
          />
          <div
            className={cn(
              'h-9 w-64 rounded animate-pulse mb-2',
              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
            )}
          />
          <div
            className={cn(
              'h-4 w-32 rounded animate-pulse',
              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
            )}
          />
        </div>
        {/* Skeleton metrics */}
        <div className={cn('flex flex-wrap gap-x-10 gap-y-4 pt-5 pb-3 border-b', styles.border)}>
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div
                className={cn(
                  'h-3 w-16 rounded animate-pulse mb-2',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
              <div
                className={cn(
                  'h-8 w-24 rounded animate-pulse',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
            </div>
          ))}
        </div>
        {/* Skeleton table */}
        <div className="pt-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-10 animate-pulse mb-0.5',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : ''
              )}
            />
          ))}
        </div>
      </div>
    )
  }

  const hasAddress = vendor.addressLine1 || vendor.city || vendor.state
  const address = [
    vendor.addressLine1,
    vendor.addressLine2,
    [vendor.city, vendor.state, vendor.postalCode].filter(Boolean).join(', '),
    vendor.country,
  ]
    .filter(Boolean)
    .join('\n')

  const tabs: { key: DetailTab; label: string; count: number; icon: typeof FileText }[] = [
    { key: 'invoices', label: 'Invoices', count: summary?.invoiceCount ?? 0, icon: FileText },
    {
      key: 'orders',
      label: 'Purchase Orders',
      count: summary?.orderCount ?? 0,
      icon: ShoppingCart,
    },
    {
      key: 'creditMemos',
      label: 'Credit Memos',
      count: summary?.creditMemoCount ?? 0,
      icon: CreditCard,
    },
    { key: 'receipts', label: 'Receipts', count: summary?.receiptCount ?? 0, icon: Package },
  ]

  return (
    <div
      className={cn(
        '@container space-y-6',
        inline
          ? cn(
              'my-3 border border-[var(--theme-card-border)] overflow-hidden scroll-mt-4 pb-6 [&>*:not(:first-child)]:px-6 bg-[var(--theme-card-bg)]',
              isLight ? 'shadow-lg shadow-stone-200/50' : 'shadow-lg shadow-black/30'
            )
          : 'max-w-[1800px] mx-auto'
      )}
    >
      {/* Header */}
      <div className={cn(inline ? 'px-6 pt-5 pb-4' : 'mb-10 pt-2')}>
        {!inline && (
          <button
            onClick={() => router.push(vendorsListUrl)}
            className={cn(
              'flex items-center gap-1.5 text-sm mb-4 transition-colors',
              styles.textMuted,
              'hover:text-amber-500'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Vendors
          </button>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              className={cn(
                'theme-text-primary tracking-tight',
                inline ? 'text-lg font-semibold' : 'dashboard-title text-[36px] font-light'
              )}
            >
              {vendor.displayName}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
                {vendor.number}
              </p>
              {vendor.blocked && vendor.blocked !== ' ' && (
                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide bg-red-500/15 text-red-400">
                  Blocked: {vendor.blocked}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadPDF}
              disabled={isLoading || isDownloadingPDF}
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Download PDF"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
            {inline && onClose && (
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isLight
                    ? 'hover:bg-stone-100 text-stone-400'
                    : 'hover:bg-white/[0.06] text-stone-500'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vendor Info Cards */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className={cn('rounded-lg border p-4 space-y-3', styles.card)}>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider', styles.textMuted)}>
            Contact Information
          </h3>
          <div className="space-y-2 text-sm">
            {hasAddress && (
              <div className="flex items-start gap-2">
                <MapPin className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', styles.textMuted)} />
                <span className={cn('whitespace-pre-line', styles.text)}>{address}</span>
              </div>
            )}
            {vendor.phoneNumber && (
              <div className="flex items-center gap-2">
                <Phone className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                <span className={styles.text}>{vendor.phoneNumber}</span>
              </div>
            )}
            {vendor.email && (
              <div className="flex items-center gap-2">
                <Mail className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                <span className={cn('truncate', styles.text)}>{vendor.email}</span>
              </div>
            )}
            {vendor.website && (
              <div className="flex items-center gap-2">
                <Globe className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                <span className={cn('truncate', styles.text)}>{vendor.website}</span>
              </div>
            )}
            {!hasAddress && !vendor.phoneNumber && !vendor.email && !vendor.website && (
              <p className={styles.textMuted}>No contact information available</p>
            )}
          </div>
        </div>

        {/* Financial Terms */}
        <div className={cn('rounded-lg border p-4 space-y-3', styles.card)}>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider', styles.textMuted)}>
            Financial Terms
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={styles.textMuted}>Payment Terms</span>
              <span className={cn('font-medium', styles.text)}>
                {vendor.paymentTerms?.displayName || vendor.paymentTerms?.code || '—'}
              </span>
            </div>
            {vendor.paymentTerms?.dueDateCalculation && (
              <div className="flex justify-between">
                <span className={styles.textMuted}>Due Date Calc.</span>
                <span className={cn('font-mono text-xs', styles.text)}>
                  {vendor.paymentTerms.dueDateCalculation}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className={styles.textMuted}>Payment Method</span>
              <span className={cn('font-medium', styles.text)}>
                {vendor.paymentMethod?.displayName || vendor.paymentMethod?.code || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={styles.textMuted}>Currency</span>
              <span className={cn('font-medium', styles.text)}>
                {vendor.currency?.displayName ||
                  vendor.currencyCode ||
                  (lcyCurrency ? `${lcyCurrency} (LCY)` : 'LCY')}
              </span>
            </div>
            {vendor.taxRegistrationNumber && (
              <div className="flex justify-between">
                <span className={styles.textMuted}>Tax Reg. #</span>
                <span className={cn('font-mono text-xs', styles.text)}>
                  {vendor.taxRegistrationNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Aging Summary */}
        <div className={cn('rounded-lg border p-4 space-y-3', styles.card)}>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider', styles.textMuted)}>
            Aging Summary{lcyCurrency ? ` (${lcyCurrency})` : ''}
          </h3>
          {agedPayable ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className={styles.textMuted}>Balance Due</span>
                <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
                  {formatCurrency(agedPayable.balanceDue, { currency: lcyCurrency })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isLight ? 'text-emerald-600' : 'text-emerald-400'}>Current</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    isLight ? 'text-emerald-600' : 'text-emerald-400'
                  )}
                >
                  {formatCurrency(agedPayable.currentAmount, { currency: lcyCurrency })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isLight ? 'text-amber-600' : 'text-amber-400'}>1-30 Days</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    isLight ? 'text-amber-600' : 'text-amber-400'
                  )}
                >
                  {formatCurrency(agedPayable.period1Amount, { currency: lcyCurrency })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isLight ? 'text-amber-600' : 'text-amber-400'}>31-60 Days</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    isLight ? 'text-amber-600' : 'text-amber-400'
                  )}
                >
                  {formatCurrency(agedPayable.period2Amount, { currency: lcyCurrency })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isLight ? 'text-red-600' : 'text-red-400'}>61+ Days</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    isLight ? 'text-red-600' : 'text-red-400'
                  )}
                >
                  {formatCurrency(agedPayable.period3Amount, { currency: lcyCurrency })}
                </span>
              </div>
              {isMultiCurrency && (
                <p className={cn('text-[10px] pt-1', styles.textMuted)}>
                  Aged amounts in {lcyCurrency} (LCY) &middot; Vendor trades in {vendorCurrency}
                </p>
              )}
            </div>
          ) : (
            <p className={cn('text-sm', styles.textMuted)}>No outstanding balance</p>
          )}
        </div>
      </div>

      {/* Key metrics strip */}
      {summary &&
        (() => {
          const overdue = agedPayable
            ? Math.abs(agedPayable.period1Amount || 0) +
              Math.abs(agedPayable.period2Amount || 0) +
              Math.abs(agedPayable.period3Amount || 0)
            : 0
          return (
            <div
              className={cn(
                'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
                styles.border
              )}
            >
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Balance Due{lcyCurrency ? ` (${lcyCurrency})` : ''}
                </div>
                <div
                  className={cn(
                    'text-[28px] font-mono font-semibold tabular-nums',
                    vendor.balance > 0 ? 'text-theme-red' : styles.text
                  )}
                >
                  {formatCompactCurrency(vendor.balance, lcyCurrency)}
                </div>
                {overdue > 0 && (
                  <div
                    className={cn(
                      'text-xs font-mono tabular-nums mt-0.5',
                      isLight ? 'text-red-600' : 'text-red-400'
                    )}
                  >
                    {formatCompactCurrency(overdue, lcyCurrency)} overdue
                  </div>
                )}
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Total Invoiced{vendorCurrency ? ` (${vendorCurrency})` : ''}
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {formatCompactCurrency(summary.totalInvoiced, vendorCurrency)}
                </div>
                <div className={cn('text-xs font-mono tabular-nums mt-0.5', styles.textMuted)}>
                  {summary.invoiceCount} invoice{summary.invoiceCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Credit Memos{vendorCurrency ? ` (${vendorCurrency})` : ''}
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {formatCompactCurrency(summary.totalCreditMemos, vendorCurrency)}
                </div>
                <div className={cn('text-xs font-mono tabular-nums mt-0.5', styles.textMuted)}>
                  {summary.creditMemoCount} memo{summary.creditMemoCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                  Open POs
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {summary.openOrders}
                </div>
                <div className={cn('text-xs font-mono tabular-nums mt-0.5', styles.textMuted)}>
                  of {summary.orderCount} total
                </div>
              </div>
            </div>
          )
        })()}

      {/* Tab navigation */}
      <div className="pt-2">
        <div
          className={cn(
            'flex items-end gap-0 shadow-sm overflow-x-auto',
            isLight ? 'shadow-stone-200/50' : 'shadow-black/20'
          )}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  setSortKey(
                    tab.key === 'orders'
                      ? 'orderDate'
                      : tab.key === 'creditMemos'
                        ? 'creditMemoDate'
                        : 'postingDate'
                  )
                  setSortDir('desc')
                  setExpandedRowId(null)
                  setSearchQuery('')
                }}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors whitespace-nowrap flex items-center gap-2',
                  activeTab === tab.key
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
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span
                  className={cn(
                    'text-[11px] font-mono px-1.5 py-0.5 rounded',
                    activeTab === tab.key
                      ? isLight
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-amber-500/20 text-amber-400'
                      : isLight
                        ? 'bg-stone-200 text-stone-500'
                        : 'bg-white/[0.06] text-stone-500'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="pt-6">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search
              className={cn(
                'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5',
                isLight ? 'text-stone-400' : 'text-stone-500'
              )}
            />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'invoices' ? 'invoices' : activeTab === 'orders' ? 'orders' : activeTab === 'creditMemos' ? 'credit memos' : 'receipts'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-8 pr-3 py-1.5 text-xs rounded-md border outline-none transition-colors',
                isLight
                  ? 'bg-white border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-amber-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-stone-500 focus:border-amber-500/50'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded',
                  isLight
                    ? 'hover:bg-stone-100 text-stone-400'
                    : 'hover:bg-white/[0.06] text-stone-500'
                )}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* ── Invoices Tab ── */}
          {activeTab === 'invoices' &&
            (() => {
              const q = searchQuery.toLowerCase().trim()
              const filteredInvoices = q
                ? invoices.filter(
                    (inv) =>
                      (inv.number || '').toLowerCase().includes(q) ||
                      (inv.vendorInvoiceNumber || '').toLowerCase().includes(q) ||
                      (inv.orderNumber || '').toLowerCase().includes(q) ||
                      (inv.status || '').toLowerCase().includes(q) ||
                      formatDate(inv.invoiceDate).toLowerCase().includes(q) ||
                      formatDate(inv.dueDate).toLowerCase().includes(q) ||
                      String(inv.totalAmountIncludingTax).includes(q)
                  )
                : invoices
              return filteredInvoices.length > 0 ? (
                <div
                  className="overflow-auto max-h-[600px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                  }}
                >
                  <table className="w-full text-sm">
                    <thead
                      className={cn(
                        'sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
                      <tr className={cn('border-b', styles.border)}>
                        {[
                          { key: 'number', label: 'Invoice #', align: 'left' },
                          { key: 'vendorInvoiceNumber', label: 'Vendor Ref', align: 'left' },
                          { key: 'invoiceDate', label: 'Invoice Date', align: 'left' },
                          { key: 'dueDate', label: 'Due Date', align: 'left' },
                          { key: 'status', label: 'Status', align: 'left' },
                          { key: 'totalAmountIncludingTax', label: 'Amount', align: 'right' },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              'py-2 px-2 font-medium whitespace-nowrap',
                              col.align === 'right' ? 'text-right' : 'text-left',
                              styles.textMuted
                            )}
                          >
                            <button
                              onClick={() => handleSort(col.key)}
                              className={cn(
                                'flex items-center gap-1 cursor-pointer select-none',
                                col.align === 'right' && 'justify-end ml-auto'
                              )}
                            >
                              {col.label} <SortIcon col={col.key} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortItems(filteredInvoices).map((inv: BCPurchaseInvoice, i: number) => {
                        const isExpanded = expandedRowId === inv.id
                        return (
                          <React.Fragment key={inv.id || i}>
                            <tr
                              onClick={() => inv.id && toggleRow(inv.id)}
                              className={cn(
                                'transition-colors cursor-pointer',
                                i % 2 === 0
                                  ? isLight
                                    ? 'bg-stone-100/80'
                                    : 'bg-white/[0.02]'
                                  : '',
                                isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]',
                                isExpanded && (isLight ? 'bg-stone-200/80' : 'bg-white/[0.05]')
                              )}
                            >
                              <td className={cn('py-2 px-2 font-mono font-medium', styles.text)}>
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight
                                    className={cn(
                                      'w-3 h-3 shrink-0 transition-transform',
                                      isExpanded && 'rotate-90',
                                      isExpanded ? 'text-amber-500' : styles.textMuted
                                    )}
                                  />
                                  {inv.number}
                                </span>
                              </td>
                              <td className={cn('py-2 px-2', styles.textMuted)}>
                                {inv.vendorInvoiceNumber || '—'}
                                {inv.orderNumber && (
                                  <span className={cn('block text-[10px]', styles.textMuted)}>
                                    PO: {inv.orderNumber}
                                  </span>
                                )}
                              </td>
                              <td className={cn('py-2 px-2 whitespace-nowrap', styles.text)}>
                                {formatDate(inv.invoiceDate)}
                              </td>
                              <td className={cn('py-2 px-2 whitespace-nowrap', styles.text)}>
                                {formatDate(inv.dueDate)}
                              </td>
                              <td className="py-2 px-2">
                                <StatusBadge status={inv.status} isLight={isLight} />
                              </td>
                              <td
                                className={cn(
                                  'py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                                  styles.text
                                )}
                              >
                                {formatCurrency(inv.totalAmountIncludingTax, {
                                  currency: resolveDocCurrency(inv.currencyCode),
                                })}
                              </td>
                            </tr>
                            {isExpanded && (
                              <DocumentLineItems
                                connectionId={connectionId}
                                documentType="invoice"
                                documentId={inv.id}
                                currency={resolveDocCurrency(inv.currencyCode)}
                                isLight={isLight}
                                colSpan={6}
                              />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                    <tfoot
                      className={cn(
                        'sticky bottom-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_-1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
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
                          colSpan={5}
                        >
                          Total ({filteredInvoices.length} invoice
                          {filteredInvoices.length !== 1 ? 's' : ''}
                          {searchQuery ? ' matching' : ''})
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatCurrency(
                            filteredInvoices.reduce(
                              (sum, inv) => sum + (inv.totalAmountIncludingTax || 0),
                              0
                            ),
                            { currency: vendorCurrency }
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className={cn('text-sm py-4', styles.textMuted)}>
                  {searchQuery
                    ? 'No invoices match your search.'
                    : 'No purchase invoices found for this vendor.'}
                </p>
              )
            })()}

          {/* ── Purchase Orders Tab ── */}
          {activeTab === 'orders' &&
            (() => {
              const q = searchQuery.toLowerCase().trim()
              const filteredOrders = q
                ? orders.filter(
                    (o) =>
                      (o.number || '').toLowerCase().includes(q) ||
                      (o.status || '').toLowerCase().includes(q) ||
                      formatDate(o.orderDate).toLowerCase().includes(q) ||
                      String(o.totalAmountIncludingTax).includes(q)
                  )
                : orders
              return filteredOrders.length > 0 ? (
                <div
                  className="overflow-auto max-h-[600px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                  }}
                >
                  <table className="w-full text-sm">
                    <thead
                      className={cn(
                        'sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
                      <tr className={cn('border-b', styles.border)}>
                        {[
                          { key: 'number', label: 'PO #', align: 'left' },
                          { key: 'orderDate', label: 'Order Date', align: 'left' },
                          { key: 'status', label: 'Status', align: 'left' },
                          { key: 'fullyReceived', label: 'Received', align: 'left' },
                          { key: 'totalAmountIncludingTax', label: 'Amount', align: 'right' },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              'py-2 px-2 font-medium whitespace-nowrap',
                              col.align === 'right' ? 'text-right' : 'text-left',
                              styles.textMuted
                            )}
                          >
                            <button
                              onClick={() => handleSort(col.key)}
                              className={cn(
                                'flex items-center gap-1 cursor-pointer select-none',
                                col.align === 'right' && 'justify-end ml-auto'
                              )}
                            >
                              {col.label} <SortIcon col={col.key} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortItems(filteredOrders).map((order: BCPurchaseOrder, i: number) => {
                        const isExpanded = expandedRowId === order.id
                        return (
                          <React.Fragment key={order.id || i}>
                            <tr
                              onClick={() => order.id && toggleRow(order.id)}
                              className={cn(
                                'transition-colors cursor-pointer',
                                i % 2 === 0
                                  ? isLight
                                    ? 'bg-stone-100/80'
                                    : 'bg-white/[0.02]'
                                  : '',
                                isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]',
                                isExpanded && (isLight ? 'bg-stone-200/80' : 'bg-white/[0.05]')
                              )}
                            >
                              <td className={cn('py-2 px-2 font-mono font-medium', styles.text)}>
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight
                                    className={cn(
                                      'w-3 h-3 shrink-0 transition-transform',
                                      isExpanded && 'rotate-90',
                                      isExpanded ? 'text-amber-500' : styles.textMuted
                                    )}
                                  />
                                  {order.number}
                                </span>
                              </td>
                              <td className={cn('py-2 px-2 whitespace-nowrap', styles.text)}>
                                {formatDate(order.orderDate)}
                              </td>
                              <td className="py-2 px-2">
                                <StatusBadge status={order.status} isLight={isLight} />
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className={cn(
                                    'inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide',
                                    order.fullyReceived
                                      ? isLight
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-emerald-500/15 text-emerald-400'
                                      : isLight
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-amber-500/15 text-amber-400'
                                  )}
                                >
                                  {order.fullyReceived ? 'Yes' : 'Partial'}
                                </span>
                              </td>
                              <td
                                className={cn(
                                  'py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                                  styles.text
                                )}
                              >
                                {formatCurrency(order.totalAmountIncludingTax, {
                                  currency: resolveDocCurrency(order.currencyCode),
                                })}
                              </td>
                            </tr>
                            {isExpanded && (
                              <DocumentLineItems
                                connectionId={connectionId}
                                documentType="order"
                                documentId={order.id}
                                currency={resolveDocCurrency(order.currencyCode)}
                                isLight={isLight}
                                colSpan={5}
                              />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                    <tfoot
                      className={cn(
                        'sticky bottom-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_-1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
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
                          colSpan={4}
                        >
                          Total ({filteredOrders.length} order
                          {filteredOrders.length !== 1 ? 's' : ''}
                          {searchQuery ? ' matching' : ''})
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatCurrency(
                            filteredOrders.reduce(
                              (sum, o) => sum + (o.totalAmountIncludingTax || 0),
                              0
                            ),
                            { currency: vendorCurrency }
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className={cn('text-sm py-4', styles.textMuted)}>
                  {searchQuery
                    ? 'No orders match your search.'
                    : 'No purchase orders found for this vendor.'}
                </p>
              )
            })()}

          {/* ── Credit Memos Tab ── */}
          {activeTab === 'creditMemos' &&
            (() => {
              const q = searchQuery.toLowerCase().trim()
              const filteredCreditMemos = q
                ? creditMemos.filter(
                    (cm) =>
                      (cm.number || '').toLowerCase().includes(q) ||
                      (cm.invoiceNumber || '').toLowerCase().includes(q) ||
                      (cm.status || '').toLowerCase().includes(q) ||
                      formatDate(cm.creditMemoDate).toLowerCase().includes(q) ||
                      String(cm.totalAmountIncludingTax).includes(q)
                  )
                : creditMemos
              return filteredCreditMemos.length > 0 ? (
                <div
                  className="overflow-auto max-h-[600px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                  }}
                >
                  <table className="w-full text-sm">
                    <thead
                      className={cn(
                        'sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
                      <tr className={cn('border-b', styles.border)}>
                        {[
                          { key: 'number', label: 'CM #', align: 'left' },
                          { key: 'creditMemoDate', label: 'Date', align: 'left' },
                          { key: 'invoiceNumber', label: 'Linked Invoice', align: 'left' },
                          { key: 'status', label: 'Status', align: 'left' },
                          { key: 'totalAmountIncludingTax', label: 'Amount', align: 'right' },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              'py-2 px-2 font-medium whitespace-nowrap',
                              col.align === 'right' ? 'text-right' : 'text-left',
                              styles.textMuted
                            )}
                          >
                            <button
                              onClick={() => handleSort(col.key)}
                              className={cn(
                                'flex items-center gap-1 cursor-pointer select-none',
                                col.align === 'right' && 'justify-end ml-auto'
                              )}
                            >
                              {col.label} <SortIcon col={col.key} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortItems(filteredCreditMemos).map((cm: BCPurchaseCreditMemo, i: number) => {
                        const isExpanded = expandedRowId === cm.id
                        return (
                          <React.Fragment key={cm.id || i}>
                            <tr
                              onClick={() => cm.id && toggleRow(cm.id)}
                              className={cn(
                                'transition-colors cursor-pointer',
                                i % 2 === 0
                                  ? isLight
                                    ? 'bg-stone-100/80'
                                    : 'bg-white/[0.02]'
                                  : '',
                                isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]',
                                isExpanded && (isLight ? 'bg-stone-200/80' : 'bg-white/[0.05]')
                              )}
                            >
                              <td className={cn('py-2 px-2 font-mono font-medium', styles.text)}>
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight
                                    className={cn(
                                      'w-3 h-3 shrink-0 transition-transform',
                                      isExpanded && 'rotate-90',
                                      isExpanded ? 'text-amber-500' : styles.textMuted
                                    )}
                                  />
                                  {cm.number}
                                </span>
                              </td>
                              <td className={cn('py-2 px-2 whitespace-nowrap', styles.text)}>
                                {formatDate(cm.creditMemoDate)}
                              </td>
                              <td className={cn('py-2 px-2 font-mono', styles.textMuted)}>
                                {cm.invoiceNumber || '—'}
                              </td>
                              <td className="py-2 px-2">
                                <StatusBadge status={cm.status} isLight={isLight} />
                              </td>
                              <td
                                className={cn(
                                  'py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                                  styles.text
                                )}
                              >
                                {formatCurrency(cm.totalAmountIncludingTax, {
                                  currency: resolveDocCurrency(cm.currencyCode),
                                })}
                              </td>
                            </tr>
                            {isExpanded && (
                              <DocumentLineItems
                                connectionId={connectionId}
                                documentType="creditMemo"
                                documentId={cm.id}
                                currency={resolveDocCurrency(cm.currencyCode)}
                                isLight={isLight}
                                colSpan={5}
                              />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                    <tfoot
                      className={cn(
                        'sticky bottom-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_-1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
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
                          colSpan={4}
                        >
                          Total ({filteredCreditMemos.length} credit memo
                          {filteredCreditMemos.length !== 1 ? 's' : ''}
                          {searchQuery ? ' matching' : ''})
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                            styles.text
                          )}
                        >
                          {formatCurrency(
                            filteredCreditMemos.reduce(
                              (sum, cm) => sum + (cm.totalAmountIncludingTax || 0),
                              0
                            ),
                            { currency: vendorCurrency }
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className={cn('text-sm py-4', styles.textMuted)}>
                  {searchQuery
                    ? 'No credit memos match your search.'
                    : 'No credit memos found for this vendor.'}
                </p>
              )
            })()}

          {/* ── Receipts Tab ── */}
          {activeTab === 'receipts' &&
            (() => {
              const q = searchQuery.toLowerCase().trim()
              const filteredReceipts = q
                ? receipts.filter(
                    (r) =>
                      (r.number || '').toLowerCase().includes(q) ||
                      (r.orderNumber || '').toLowerCase().includes(q) ||
                      formatDate(r.postingDate).toLowerCase().includes(q)
                  )
                : receipts
              return filteredReceipts.length > 0 ? (
                <div
                  className="overflow-auto max-h-[600px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                  }}
                >
                  <table className="w-full text-sm">
                    <thead
                      className={cn(
                        'sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
                      <tr className={cn('border-b', styles.border)}>
                        {[
                          { key: 'number', label: 'Receipt #', align: 'left' },
                          { key: 'postingDate', label: 'Posting Date', align: 'left' },
                          { key: 'orderNumber', label: 'PO #', align: 'left' },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              'py-2 px-2 font-medium whitespace-nowrap text-left',
                              styles.textMuted
                            )}
                          >
                            <button
                              onClick={() => handleSort(col.key)}
                              className="flex items-center gap-1 cursor-pointer select-none"
                            >
                              {col.label} <SortIcon col={col.key} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortItems(filteredReceipts).map((receipt: BCPurchaseReceipt, i: number) => {
                        const isExpanded = expandedRowId === receipt.id
                        return (
                          <React.Fragment key={receipt.id || i}>
                            <tr
                              onClick={() => receipt.id && toggleRow(receipt.id)}
                              className={cn(
                                'transition-colors cursor-pointer',
                                i % 2 === 0
                                  ? isLight
                                    ? 'bg-stone-100/80'
                                    : 'bg-white/[0.02]'
                                  : '',
                                isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]',
                                isExpanded && (isLight ? 'bg-stone-200/80' : 'bg-white/[0.05]')
                              )}
                            >
                              <td className={cn('py-2 px-2 font-mono font-medium', styles.text)}>
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight
                                    className={cn(
                                      'w-3 h-3 shrink-0 transition-transform',
                                      isExpanded && 'rotate-90',
                                      isExpanded ? 'text-amber-500' : styles.textMuted
                                    )}
                                  />
                                  {receipt.number}
                                </span>
                              </td>
                              <td className={cn('py-2 px-2 whitespace-nowrap', styles.text)}>
                                {formatDate(receipt.postingDate)}
                              </td>
                              <td className={cn('py-2 px-2 font-mono', styles.textMuted)}>
                                {receipt.orderNumber || '—'}
                              </td>
                            </tr>
                            {isExpanded && (
                              <DocumentLineItems
                                connectionId={connectionId}
                                documentType="receipt"
                                documentId={receipt.id}
                                currency={vendorCurrency}
                                isLight={isLight}
                                colSpan={3}
                              />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                    <tfoot
                      className={cn(
                        'sticky bottom-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]',
                        isLight
                          ? 'bg-white'
                          : 'bg-[rgb(var(--theme-bg-rgb))] shadow-[0_-1px_3px_rgba(0,0,0,0.3)]'
                      )}
                    >
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
                          colSpan={3}
                        >
                          Total ({filteredReceipts.length} receipt
                          {filteredReceipts.length !== 1 ? 's' : ''}
                          {searchQuery ? ' matching' : ''})
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className={cn('text-sm py-4', styles.textMuted)}>
                  {searchQuery
                    ? 'No receipts match your search.'
                    : 'No purchase receipts found for this vendor.'}
                </p>
              )
            })()}
        </div>
      </div>
    </div>
  )
}
