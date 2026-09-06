'use client'

import { useShopifyCustomerDetail } from '../hooks/useShopifyData'
import type { ShopifyCustomerDetail } from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  ShoppingBag,
  DollarSign,
  Clock,
  MapPin,
  Tag,
  StickyNote,
  X,
  Megaphone,
  Database,
  Activity,
  AlertTriangle,
  MessageSquare,
  Pencil,
  PackageCheck,
  RefreshCcw,
  XCircle,
} from 'lucide-react'

function fmt(amount: string | number, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Group key for an event date — "Today", "Yesterday", or "MMM D, YYYY". */
function dayKey(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (d >= startOfToday) return 'Today'
  if (d >= startOfYesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Strip HTML from Shopify's FormattedString. The message field can contain
 * <a> tags pointing at admin resources — we render plain text only to avoid
 * any XSS or markup-injection risk from the connected store.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

type EventTone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral'

/** Map a Shopify event action verb → icon + tone (color). */
function classifyEvent(
  action: string,
  criticalAlert: boolean
): {
  icon: React.ElementType
  tone: EventTone
} {
  if (criticalAlert) return { icon: AlertTriangle, tone: 'warning' }
  const a = action.toLowerCase()
  if (a.includes('placed_order') || a.includes('confirmed')) {
    return { icon: ShoppingBag, tone: 'positive' }
  }
  if (a.includes('paid') || a.includes('captured') || a.includes('authorized')) {
    return { icon: DollarSign, tone: 'positive' }
  }
  if (a.includes('fulfilled') || a.includes('shipped') || a.includes('delivered')) {
    return { icon: PackageCheck, tone: 'positive' }
  }
  if (a.includes('refund')) return { icon: RefreshCcw, tone: 'negative' }
  if (a.includes('cancel')) return { icon: XCircle, tone: 'negative' }
  if (a.includes('comment')) return { icon: MessageSquare, tone: 'neutral' }
  if (a.includes('email') || a.includes('sent')) return { icon: Mail, tone: 'info' }
  if (a.includes('update') || a.includes('edit')) return { icon: Pencil, tone: 'info' }
  return { icon: Activity, tone: 'neutral' }
}

function toneClasses(tone: EventTone, isLight: boolean) {
  switch (tone) {
    case 'positive':
      return {
        icon: 'text-emerald-600 dark:text-emerald-400',
        ring: isLight ? 'ring-emerald-200' : 'ring-emerald-500/30',
        bg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10',
      }
    case 'negative':
      return {
        icon: 'text-red-600 dark:text-red-400',
        ring: isLight ? 'ring-red-200' : 'ring-red-500/30',
        bg: isLight ? 'bg-red-50' : 'bg-red-500/10',
      }
    case 'warning':
      return {
        icon: 'text-amber-600 dark:text-amber-400',
        ring: isLight ? 'ring-amber-200' : 'ring-amber-500/30',
        bg: isLight ? 'bg-amber-50' : 'bg-amber-500/10',
      }
    case 'info':
      return {
        icon: 'text-blue-600 dark:text-blue-400',
        ring: isLight ? 'ring-blue-200' : 'ring-blue-500/30',
        bg: isLight ? 'bg-blue-50' : 'bg-blue-500/10',
      }
    default:
      return {
        icon: isLight ? 'text-stone-500' : 'text-stone-400',
        ring: isLight ? 'ring-stone-200' : 'ring-white/[0.08]',
        bg: isLight ? 'bg-stone-100' : 'bg-white/[0.04]',
      }
  }
}

function SectionLabel({
  icon: Icon,
  label,
  count,
  isLight,
}: {
  icon: React.ElementType
  label: string
  count?: number
  isLight: boolean
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-stone-500" />
      <span
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          isLight ? 'text-stone-600' : 'text-stone-400'
        )}
      >
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] font-mono text-stone-500">({count})</span>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  isLight,
  variant = 'default',
}: {
  status: string
  isLight: boolean
  variant?: 'financial' | 'fulfillment' | 'default'
}) {
  let colorClass = ''

  if (variant === 'financial') {
    switch (status) {
      case 'PAID':
        colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        break
      case 'PARTIALLY_PAID':
        colorClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        break
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        break
      case 'PENDING':
      case 'AUTHORIZED':
        colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        break
      default:
        colorClass = isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.08] text-stone-400'
    }
  } else if (variant === 'fulfillment') {
    switch (status) {
      case 'FULFILLED':
        colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        break
      case 'PARTIALLY_FULFILLED':
      case 'IN_PROGRESS':
        colorClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        break
      case 'UNFULFILLED':
        colorClass = isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.08] text-stone-400'
        break
      default:
        colorClass = isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.08] text-stone-400'
    }
  } else {
    colorClass = isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.08] text-stone-400'
  }

  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
        colorClass
      )}
    >
      {status?.toLowerCase().replace(/_/g, ' ') || '-'}
    </span>
  )
}

export function CustomerDetailPanel({
  customerId,
  isLight,
  onClose,
}: {
  customerId: number
  isLight: boolean
  onClose: () => void
}) {
  const { data: customer, isLoading, error } = useShopifyCustomerDetail(String(customerId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading customer details...</span>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load customer details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const cur = customer.amountSpent?.currencyCode || 'USD'
  const orders = customer.orders?.edges?.map((e) => e.node) ?? []
  const recentOrders = orders.slice(0, 10)
  const metafields = customer.metafields?.edges?.map((e) => e.node) ?? []
  const predictedTier = customer.statistics?.predictedSpendTier ?? null
  const rfmGroup = customer.statistics?.rfmGroup ?? null
  const storeCreditAccounts = customer.storeCreditAccounts?.edges?.map((e) => e.node) ?? []
  const totalStoreCreditBalance = storeCreditAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance.amount || '0'),
    0
  )
  const storeCreditCurrency = storeCreditAccounts[0]?.balance.currencyCode || cur
  const hasInsights = predictedTier != null || rfmGroup != null || totalStoreCreditBalance > 0

  // Activity timeline events — grouped by day, newest first.
  const events = customer.events?.edges?.map((e) => e.node) ?? []
  const groupedEvents = events.reduce<Record<string, typeof events>>((acc, ev) => {
    const key = dayKey(ev.createdAt)
    if (!acc[key]) acc[key] = []
    acc[key].push(ev)
    return acc
  }, {})
  const groupedEntries = Object.entries(groupedEvents)

  const cardStyle = cn(
    'rounded-lg border p-4 space-y-3',
    isLight
      ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
      : 'bg-white/[0.02] border-[var(--theme-card-border)]'
  )

  return (
    <div
      className={cn(
        '@container my-3 border border-[var(--theme-card-border)] overflow-hidden scroll-mt-4 pb-6 [&>*:not(:first-child)]:px-6 bg-[var(--theme-card-bg)] space-y-5',
        isLight ? 'shadow-lg shadow-stone-200/50' : 'shadow-lg shadow-black/30'
      )}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {customer.image?.url ? (
              <img
                src={customer.image.url}
                alt={customer.displayName}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold',
                  isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/[0.08] text-stone-400'
                )}
              >
                {(customer.firstName?.[0] || customer.displayName?.[0] || '?').toUpperCase()}
              </div>
            )}
            <div>
              <h2
                className={cn(
                  'text-lg font-semibold tracking-tight',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {customer.displayName}
              </h2>
              {customer.email && (
                <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
                  {customer.email}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isLight ? 'hover:bg-stone-100 text-stone-400' : 'hover:bg-white/[0.06] text-stone-500'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Contact Info
          </h3>
          <div className="space-y-2 text-sm">
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                <span className="text-stone-500 truncate">{customer.email}</span>
                {customer.verifiedEmail && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0">
                    verified
                  </span>
                )}
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                <span className="text-stone-500">{customer.phone}</span>
              </div>
            )}
            {customer.locale && (
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                <span className="text-stone-500">{customer.locale}</span>
              </div>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-stone-500">State</span>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                  customer.state === 'ENABLED'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : customer.state === 'INVITED'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : isLight
                        ? 'bg-stone-100 text-stone-600'
                        : 'bg-white/[0.08] text-stone-400'
                )}
              >
                {customer.state?.toLowerCase() || 'unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Lifetime Stats */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Lifetime Stats
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Total Orders</span>
              <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {customer.numberOfOrders}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Amount Spent</span>
              <span
                className={cn(
                  'font-mono text-xs font-medium',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {fmt(customer.amountSpent.amount, cur)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Lifetime</span>
              <span className={cn('text-xs', isLight ? 'text-stone-700' : 'text-stone-300')}>
                {customer.lifetimeDuration}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Tax Exempt</span>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                  customer.taxExempt
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : isLight
                      ? 'bg-stone-100 text-stone-600'
                      : 'bg-white/[0.08] text-stone-400'
                )}
              >
                {customer.taxExempt ? 'yes' : 'no'}
              </span>
            </div>
          </div>
        </div>

        {/* Marketing Consent */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Marketing Consent
          </h3>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500">
                <Mail className="w-3 h-3" />
                <span className="text-xs font-medium uppercase tracking-wider">Email</span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                    customer.emailMarketingConsent?.marketingState === 'SUBSCRIBED'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : isLight
                        ? 'bg-stone-100 text-stone-600'
                        : 'bg-white/[0.08] text-stone-400'
                  )}
                >
                  {customer.emailMarketingConsent?.marketingState
                    ?.toLowerCase()
                    .replace(/_/g, ' ') || 'unknown'}
                </span>
                {customer.emailMarketingConsent?.marketingOptInLevel && (
                  <span className="text-[10px] text-stone-500">
                    {customer.emailMarketingConsent.marketingOptInLevel
                      .toLowerCase()
                      .replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500">
                <Phone className="w-3 h-3" />
                <span className="text-xs font-medium uppercase tracking-wider">SMS</span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                    customer.smsMarketingConsent?.marketingState === 'SUBSCRIBED'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : isLight
                        ? 'bg-stone-100 text-stone-600'
                        : 'bg-white/[0.08] text-stone-400'
                  )}
                >
                  {customer.smsMarketingConsent?.marketingState?.toLowerCase().replace(/_/g, ' ') ||
                    'unknown'}
                </span>
                {customer.smsMarketingConsent?.marketingOptInLevel && (
                  <span className="text-[10px] text-stone-500">
                    {customer.smsMarketingConsent.marketingOptInLevel
                      .toLowerCase()
                      .replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shopify Insights — predicted tier, RFM, store credit */}
      {hasInsights && (
        <div>
          <SectionLabel icon={Megaphone} label="Shopify Insights" isLight={isLight} />
          <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
            {predictedTier && (
              <div className={cardStyle}>
                <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Predicted Spend Tier
                </h3>
                <div className="space-y-1">
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                      predictedTier === 'HIGH'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        : predictedTier === 'MEDIUM'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'
                          : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
                    )}
                  >
                    {predictedTier.toLowerCase()}
                  </span>
                  <p className="text-xs text-stone-500">
                    Shopify ML estimate of this customer&apos;s lifetime spend bracket.
                  </p>
                </div>
              </div>
            )}
            {rfmGroup && (
              <div className={cardStyle}>
                <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  RFM Group
                </h3>
                <div className="space-y-1">
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium font-mono',
                      isLight ? 'bg-stone-100 text-stone-700' : 'bg-white/[0.08] text-stone-300'
                    )}
                  >
                    {rfmGroup}
                  </span>
                  <p className="text-xs text-stone-500">
                    Recency, Frequency, Monetary segmentation from Shopify.
                  </p>
                </div>
              </div>
            )}
            {totalStoreCreditBalance > 0 && (
              <div className={cardStyle}>
                <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Store Credit
                </h3>
                <div className="space-y-1">
                  <div
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}
                  >
                    {fmt(totalStoreCreditBalance, storeCreditCurrency)}
                  </div>
                  <p className="text-xs text-stone-500">
                    Across {storeCreditAccounts.length} account
                    {storeCreditAccounts.length !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Default Address */}
      {customer.defaultAddress && (
        <div>
          <SectionLabel icon={MapPin} label="Default Address" isLight={isLight} />
          <div className={cardStyle}>
            <div className="text-sm text-stone-500 space-y-0.5">
              {customer.defaultAddress.formatted.map((line: string, i: number) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div>
          <SectionLabel
            icon={ShoppingBag}
            label="Recent Orders"
            count={orders.length}
            isLight={isLight}
          />
          <div
            className="overflow-x-auto rounded-lg border"
            style={{
              borderColor: isLight ? 'rgb(214 211 209 / 0.8)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b',
                    isLight ? 'border-stone-200 bg-stone-50' : 'border-white/[0.08] bg-white/[0.02]'
                  )}
                >
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">Order</th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">
                    Financial
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">
                    Fulfillment
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-stone-500 text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order, i) => (
                  <tr
                    key={order.id}
                    className={cn(
                      i % 2 === 0
                        ? isLight
                          ? 'bg-white'
                          : 'bg-transparent'
                        : isLight
                          ? 'bg-stone-50'
                          : 'bg-white/[0.02]'
                    )}
                  >
                    <td
                      className={cn(
                        'px-3 py-2 font-medium',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {order.name}
                    </td>
                    <td className="px-3 py-2 text-stone-500">{fmtDate(order.createdAt)}</td>
                    <td className="px-3 py-2">
                      {order.displayFinancialStatus && (
                        <StatusBadge
                          status={order.displayFinancialStatus}
                          isLight={isLight}
                          variant="financial"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {order.displayFulfillmentStatus && (
                        <StatusBadge
                          status={order.displayFulfillmentStatus}
                          isLight={isLight}
                          variant="fulfillment"
                        />
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono tabular-nums font-medium',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {fmt(
                        order.totalPriceSet?.shopMoney?.amount ?? '0',
                        order.totalPriceSet?.shopMoney?.currencyCode ?? cur
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {events.length > 0 && (
        <div>
          <SectionLabel
            icon={Activity}
            label="Activity Timeline"
            count={events.length}
            isLight={isLight}
          />
          <div className={cardStyle}>
            <div className="space-y-5">
              {groupedEntries.map(([day, dayEvents]) => (
                <div key={day}>
                  <p
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider mb-2',
                      isLight ? 'text-stone-500' : 'text-stone-400'
                    )}
                  >
                    {day}
                  </p>
                  <ul className="relative space-y-3">
                    {/* Vertical rail behind icons */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-[11px] top-2 bottom-2 w-px',
                        isLight ? 'bg-stone-200' : 'bg-white/[0.08]'
                      )}
                    />
                    {dayEvents.map((ev) => {
                      const { icon: Icon, tone } = classifyEvent(ev.action, ev.criticalAlert)
                      const t = toneClasses(tone, isLight)
                      const message = stripHtml(ev.message)
                      return (
                        <li key={ev.id} className="relative flex items-start gap-3 pl-0">
                          <span
                            className={cn(
                              'relative z-[1] flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full ring-1',
                              t.bg,
                              t.ring
                            )}
                          >
                            <Icon className={cn('h-3 w-3', t.icon)} />
                          </span>
                          <div className="flex-1 min-w-0 -mt-0.5">
                            <p
                              className={cn(
                                'text-sm leading-snug',
                                isLight ? 'text-stone-700' : 'text-stone-200'
                              )}
                            >
                              {message}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                              <span className="font-mono tabular-nums">
                                {fmtTime(ev.createdAt)}
                              </span>
                              {ev.appTitle && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span>{ev.appTitle}</span>
                                </>
                              )}
                              {ev.attributeToUser && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span>Staff</span>
                                </>
                              )}
                              {ev.criticalAlert && (
                                <span
                                  className={cn(
                                    'ml-1 px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                                    isLight
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-amber-500/20 text-amber-300'
                                  )}
                                >
                                  Alert
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Metafields */}
      {metafields.length > 0 && (
        <div>
          <SectionLabel
            icon={Database}
            label="Metafields"
            count={metafields.length}
            isLight={isLight}
          />
          <div
            className="overflow-x-auto rounded-lg border"
            style={{
              borderColor: isLight ? 'rgb(214 211 209 / 0.8)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b',
                    isLight ? 'border-stone-200 bg-stone-50' : 'border-white/[0.08] bg-white/[0.02]'
                  )}
                >
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">
                    Namespace
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">Key</th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">Value</th>
                  <th className="text-left px-3 py-2 font-medium text-stone-500 text-xs">Type</th>
                </tr>
              </thead>
              <tbody>
                {metafields.map((mf, i) => (
                  <tr
                    key={`${mf.namespace}-${mf.key}`}
                    className={cn(
                      i % 2 === 0
                        ? isLight
                          ? 'bg-white'
                          : 'bg-transparent'
                        : isLight
                          ? 'bg-stone-50'
                          : 'bg-white/[0.02]'
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-stone-500">{mf.namespace}</td>
                    <td
                      className={cn(
                        'px-3 py-2 font-mono text-xs',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {mf.key}
                    </td>
                    <td className="px-3 py-2 text-stone-500 max-w-[200px] truncate">{mf.value}</td>
                    <td className="px-3 py-2 text-xs text-stone-500">{mf.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note + Tags */}
      {(customer.note || (customer.tags && customer.tags.length > 0)) && (
        <div className={cn(cardStyle, 'flex flex-wrap gap-6')}>
          {customer.note && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Note
              </p>
              <p className="text-sm text-stone-500 italic">{customer.note}</p>
            </div>
          )}
          {customer.tags && customer.tags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {customer.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      isLight ? 'bg-stone-200 text-stone-700' : 'bg-white/[0.08] text-stone-300'
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
