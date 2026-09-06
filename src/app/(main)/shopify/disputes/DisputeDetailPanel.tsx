'use client'

import { useShopifyDisputeDetail } from '../hooks/useShopifyData'
import type {
  ShopifyDisputeDetail,
  ShopifyDisputeEvidence,
  ShopifyDisputeLinkedOrder,
} from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Loader2,
  ShieldAlert,
  Package,
  MapPin,
  FileText,
  Clock,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

function fmt(amount: string | number, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function fmtDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtDateShort(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const now = new Date()
  const due = new Date(dateStr)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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

function StatusBadge({ status, isLight }: { status: string; isLight: boolean }) {
  const colorMap: Record<string, string> = {
    needs_response: cn('bg-red-100 text-red-800', !isLight && 'bg-red-900/30 text-red-400'),
    under_review: cn(
      'bg-yellow-100 text-yellow-800',
      !isLight && 'bg-yellow-900/30 text-yellow-400'
    ),
    open: cn('bg-yellow-100 text-yellow-800', !isLight && 'bg-yellow-900/30 text-yellow-400'),
    won: cn('bg-green-100 text-green-800', !isLight && 'bg-green-900/30 text-green-400'),
    lost: cn('bg-stone-100 text-stone-600', !isLight && 'bg-stone-700/30 text-stone-400'),
    accepted: cn('bg-stone-100 text-stone-600', !isLight && 'bg-stone-700/30 text-stone-400'),
  }
  const color =
    colorMap[status] ??
    cn('bg-stone-100 text-stone-600', !isLight && 'bg-stone-700/30 text-stone-400')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium',
        color
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function FinancialStatusBadge({ status, isLight }: { status: string; isLight: boolean }) {
  const isPaid = status === 'paid'
  const isRefunded = status === 'refunded' || status === 'partially_refunded'
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
        isPaid
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : isRefunded
            ? cn(isLight ? 'bg-red-100 text-red-800' : 'bg-red-900/30 text-red-400')
            : cn(isLight ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-900/30 text-yellow-400')
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function FulfillmentStatusBadge({ status, isLight }: { status: string | null; isLight: boolean }) {
  if (!status) {
    return (
      <span
        className={cn(
          'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
          isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'
        )}
      >
        unfulfilled
      </span>
    )
  }
  const isFulfilled = status === 'fulfilled'
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
        isFulfilled
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : cn(isLight ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-900/30 text-yellow-400')
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function formatAddress(addr: any): string[] {
  if (!addr) return []
  const lines: string[] = []
  if (addr.name) lines.push(addr.name)
  if (addr.company) lines.push(addr.company)
  if (addr.address1) lines.push(addr.address1)
  if (addr.address2) lines.push(addr.address2)
  const cityLine = [addr.city, addr.province_code || addr.province, addr.zip]
    .filter(Boolean)
    .join(', ')
  if (cityLine) lines.push(cityLine)
  if (addr.country) lines.push(addr.country)
  return lines
}

export function DisputeDetailPanel({
  disputeId,
  isLight,
  currency,
  onClose,
}: {
  disputeId: number
  isLight: boolean
  currency: string
  onClose: () => void
}) {
  const { data: dispute, isLoading, error } = useShopifyDisputeDetail(String(disputeId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading dispute details...</span>
      </div>
    )
  }

  if (error || !dispute) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load dispute details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const cur = dispute.currency || currency
  const order = dispute.order as ShopifyDisputeLinkedOrder | null
  const evidence = dispute.evidence as ShopifyDisputeEvidence | null

  const daysLeft = daysUntil(dispute.evidence_due_by)
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft < 7
  const isOverdue = daysLeft !== null && daysLeft < 0

  const cardStyle = cn(
    'rounded-lg border p-4 space-y-3',
    isLight
      ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
      : 'bg-white/[0.02] border-[var(--theme-card-border)]'
  )

  // Collect evidence fields that have content
  const evidenceFields: Array<{ label: string; value: string }> = []
  if (evidence) {
    if (evidence.customer_email_address)
      evidenceFields.push({ label: 'Customer Email', value: evidence.customer_email_address })
    if (evidence.customer_first_name)
      evidenceFields.push({ label: 'Customer First Name', value: evidence.customer_first_name })
    if (evidence.customer_last_name)
      evidenceFields.push({ label: 'Customer Last Name', value: evidence.customer_last_name })
    if (evidence.access_activity_log)
      evidenceFields.push({ label: 'Access Activity Log', value: evidence.access_activity_log })
    if (evidence.cancellation_policy_disclosure)
      evidenceFields.push({
        label: 'Cancellation Policy Disclosure',
        value: evidence.cancellation_policy_disclosure,
      })
    if (evidence.cancellation_rebuttal)
      evidenceFields.push({
        label: 'Cancellation Rebuttal',
        value: evidence.cancellation_rebuttal,
      })
    if (evidence.refund_policy_disclosure)
      evidenceFields.push({
        label: 'Refund Policy Disclosure',
        value: evidence.refund_policy_disclosure,
      })
    if (evidence.refund_refusal_explanation)
      evidenceFields.push({
        label: 'Refund Refusal Explanation',
        value: evidence.refund_refusal_explanation,
      })
    if (evidence.uncategorized_text)
      evidenceFields.push({ label: 'Uncategorized Text', value: evidence.uncategorized_text })
  }

  // Build timeline entries
  const timeline: Array<{ date: string; label: string }> = []
  if (dispute.initiated_at)
    timeline.push({ date: dispute.initiated_at, label: 'Dispute initiated' })
  if (dispute.evidence_due_by)
    timeline.push({ date: dispute.evidence_due_by, label: 'Evidence due by' })
  if (dispute.evidence_sent_on)
    timeline.push({ date: dispute.evidence_sent_on, label: 'Evidence sent' })
  if (dispute.finalized_on)
    timeline.push({ date: dispute.finalized_on, label: 'Dispute finalized' })
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const shippingLines = order?.shipping_address ? formatAddress(order.shipping_address) : []
  const billingLines = order?.billing_address ? formatAddress(order.billing_address) : []

  return (
    <div
      className={cn(
        '@container my-3 border border-[var(--theme-card-border)] overflow-hidden scroll-mt-4 pb-6 [&>*:not(:first-child)]:px-6 bg-[var(--theme-card-bg)]',
        isLight ? 'shadow-lg shadow-stone-200/50' : 'shadow-lg shadow-black/30'
      )}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2
                className={cn(
                  'text-lg font-semibold tracking-tight',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {dispute.type === 'chargeback' ? 'Chargeback' : 'Inquiry'} #{dispute.id}
              </h2>
              <StatusBadge status={dispute.status} isLight={isLight} />
            </div>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
              {fmtDate(dispute.initiated_at)}
            </p>
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
        {/* Card 1: Dispute Details */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Dispute Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Type</span>
              <span
                className={cn('font-medium capitalize', isLight ? 'text-stone-900' : 'text-white')}
              >
                {dispute.type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Reason</span>
              <span
                className={cn('font-medium capitalize', isLight ? 'text-stone-900' : 'text-white')}
              >
                {dispute.reason.replace(/_/g, ' ')}
              </span>
            </div>
            {dispute.network_reason_code && (
              <div className="flex justify-between">
                <span className="text-stone-500">Network Reason Code</span>
                <span
                  className={cn(
                    'font-mono text-xs font-medium',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {dispute.network_reason_code}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Amount</span>
              <span className={cn('font-mono tabular-nums font-medium', 'text-red-500')}>
                {fmt(dispute.amount, cur)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-500">Status</span>
              <StatusBadge status={dispute.status} isLight={isLight} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-stone-500">Evidence Due By</span>
              <span
                className={cn(
                  'font-medium text-xs',
                  isOverdue
                    ? 'text-red-500'
                    : isUrgent
                      ? cn(isLight ? 'text-amber-600' : 'text-amber-400')
                      : isLight
                        ? 'text-stone-900'
                        : 'text-white'
                )}
              >
                {fmtDateShort(dispute.evidence_due_by)}
                {isUrgent && !isOverdue && (
                  <span className="ml-1.5 text-[10px]">({daysLeft}d left)</span>
                )}
                {isOverdue && <span className="ml-1.5 text-[10px]">(overdue)</span>}
              </span>
            </div>
            {dispute.evidence_sent_on && (
              <div className="flex justify-between">
                <span className="text-stone-500">Evidence Sent On</span>
                <span
                  className={cn('font-medium text-xs', isLight ? 'text-stone-900' : 'text-white')}
                >
                  {fmtDateShort(dispute.evidence_sent_on)}
                </span>
              </div>
            )}
            {dispute.finalized_on && (
              <div className="flex justify-between">
                <span className="text-stone-500">Finalized On</span>
                <span
                  className={cn('font-medium text-xs', isLight ? 'text-stone-900' : 'text-white')}
                >
                  {fmtDateShort(dispute.finalized_on)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Linked Order */}
        {order && (
          <div className={cardStyle}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Linked Order
            </h3>
            <div className="space-y-2 text-sm">
              <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {order.name}
              </p>
              <p className="text-xs text-stone-500">{fmtDate(order.created_at)}</p>
              {order.customer && (
                <>
                  <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                    {[order.customer.first_name, order.customer.last_name]
                      .filter(Boolean)
                      .join(' ') || 'Unknown'}
                  </p>
                  {order.customer.email && <p className="text-stone-500">{order.customer.email}</p>}
                </>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Total</span>
                <span
                  className={cn(
                    'font-mono tabular-nums font-medium',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {fmt(order.total_price, order.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Financial</span>
                <FinancialStatusBadge status={order.financial_status} isLight={isLight} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Fulfillment</span>
                <FulfillmentStatusBadge status={order.fulfillment_status} isLight={isLight} />
              </div>
              {order.line_items.length > 0 && (
                <div
                  className={cn(
                    'pt-2 mt-1 border-t space-y-1',
                    isLight ? 'border-stone-200' : 'border-white/[0.08]'
                  )}
                >
                  {order.line_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className={cn(isLight ? 'text-stone-700' : 'text-stone-300')}>
                        {item.title} &times;{item.quantity}
                      </span>
                      <span
                        className={cn(
                          'font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {fmt(parseFloat(item.price) * item.quantity, order.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card 3: Addresses */}
        {(shippingLines.length > 0 || billingLines.length > 0) && (
          <div className={cardStyle}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Addresses
            </h3>
            <div className="space-y-4">
              {shippingLines.length > 0 && (
                <div>
                  <p
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider mb-1',
                      isLight ? 'text-stone-400' : 'text-stone-500'
                    )}
                  >
                    Shipping
                  </p>
                  <div className="text-sm text-stone-500 space-y-0.5">
                    {shippingLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
              {billingLines.length > 0 && (
                <div>
                  <p
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider mb-1',
                      isLight ? 'text-stone-400' : 'text-stone-500'
                    )}
                  >
                    Billing
                  </p>
                  <div className="text-sm text-stone-500 space-y-0.5">
                    {billingLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Evidence Section */}
      <div>
        <SectionLabel icon={FileText} label="Evidence" isLight={isLight} />
        {evidence === null ? (
          <div
            className={cn(
              'flex items-center gap-2 py-3 px-4 rounded-lg text-sm',
              isLight ? 'bg-stone-100/80 text-stone-500' : 'bg-white/[0.03] text-stone-500'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            No evidence submitted yet
          </div>
        ) : (
          <div className="space-y-3">
            {evidence.submitted && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={cn('w-3.5 h-3.5', isLight ? 'text-emerald-600' : 'text-emerald-400')}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    isLight ? 'text-emerald-600' : 'text-emerald-400'
                  )}
                >
                  Evidence submitted
                </span>
              </div>
            )}
            {evidenceFields.length > 0 ? (
              <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
                {evidenceFields.map((field) => (
                  <div key={field.label} className={cardStyle}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      {field.label}
                    </p>
                    <p
                      className={cn(
                        'text-sm whitespace-pre-wrap break-words',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              !evidence.submitted && (
                <p className="text-sm text-stone-500">No evidence fields populated yet.</p>
              )
            )}
          </div>
        )}
      </div>

      {/* Timeline Section */}
      {timeline.length > 0 && (
        <div>
          <SectionLabel icon={Clock} label="Timeline" isLight={isLight} />
          <div className="space-y-1.5">
            {timeline.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-stone-400 whitespace-nowrap w-28 flex-shrink-0 font-mono">
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className={cn(isLight ? 'text-stone-700' : 'text-stone-300')}>
                  {entry.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
