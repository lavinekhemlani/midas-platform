'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ShopifyReturnItem, ShopifyReturnStatus } from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import { Package, ArrowRightLeft, Truck, RotateCcw, XCircle, ExternalLink, X } from 'lucide-react'

function fmt(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function humanizeReason(reason: string): string {
  return reason
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const STATUS_COLORS: Record<ShopifyReturnStatus, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DECLINED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
}

function StatusBadge({ status }: { status: ShopifyReturnStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        STATUS_COLORS[status]
      )}
    >
      {status.toLowerCase()}
    </span>
  )
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

export function ReturnDetailPanel({
  returnItem,
  isLight,
  onClose,
}: {
  returnItem: ShopifyReturnItem
  isLight: boolean
  onClose: () => void
}) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const cur = returnItem.currency

  const cardStyle = cn(
    'rounded-lg border p-4 space-y-3',
    isLight
      ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
      : 'bg-white/[0.02] border-[var(--theme-card-border)]'
  )

  // Build deep-link to refunds page filtered to this order. The refunds page
  // doesn't currently read a query param to pre-filter, so we just send the
  // user there with the shop preserved — clicking the refund row in their
  // search will surface the linked record.
  const refundsHref = shop
    ? `/shopify/refunds?shop=${encodeURIComponent(shop)}`
    : '/shopify/refunds'

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
            <h2
              className={cn(
                'text-lg font-semibold tracking-tight flex items-center gap-2',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {returnItem.name}
              {returnItem.exchangeLineItems.length > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 font-medium',
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  )}
                >
                  <ArrowRightLeft className="w-2.5 h-2.5" />
                  Exchange
                </span>
              )}
            </h2>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
              Created {fmtDate(returnItem.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={returnItem.status} />
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
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
        {/* Card 1: Parent Order */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Parent Order
          </h3>
          <div className="space-y-2 text-sm">
            <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
              {returnItem.orderName}
            </p>
            {returnItem.customerName && (
              <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {returnItem.customerName}
              </p>
            )}
            {returnItem.customerEmail && (
              <p className="text-stone-500 text-xs">{returnItem.customerEmail}</p>
            )}
          </div>
        </div>

        {/* Card 2: Return Summary */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Return Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Status</span>
              <StatusBadge status={returnItem.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Items returning</span>
              <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {returnItem.totalQuantity}
              </span>
            </div>
            {returnItem.exchangeLineItems.length > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Exchange items</span>
                <span
                  className={cn('font-medium', isLight ? 'text-emerald-700' : 'text-emerald-400')}
                >
                  {returnItem.exchangeLineItems.length}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-500 text-xs">{fmtDate(returnItem.createdAt)}</span>
            </div>
            {returnItem.processedAt && (
              <div className="flex justify-between">
                <span className="text-stone-500">Processed</span>
                <span className="text-stone-500 text-xs">{fmtDate(returnItem.processedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Linked Refunds (deep-link) */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Linked Refunds
          </h3>
          <div className="space-y-2 text-sm">
            {returnItem.linkedRefunds.length === 0 ? (
              <p className="text-xs text-stone-500">No refunds issued yet.</p>
            ) : (
              <>
                {returnItem.linkedRefunds.map((refund) => (
                  <div key={refund.id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span
                        className={cn('text-xs', isLight ? 'text-stone-700' : 'text-stone-300')}
                      >
                        {fmtDate(refund.createdAt)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'font-mono tabular-nums font-medium',
                        isLight ? 'text-red-600' : 'text-red-400'
                      )}
                    >
                      {fmt(refund.totalRefunded, refund.currency)}
                    </span>
                  </div>
                ))}
                <Link
                  href={refundsHref}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs mt-1',
                    isLight
                      ? 'text-blue-600 hover:text-blue-700'
                      : 'text-blue-400 hover:text-blue-300'
                  )}
                >
                  View on Refunds page
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Decline reason — only when DECLINED */}
      {returnItem.status === 'DECLINED' && returnItem.declineReason && (
        <div>
          <SectionLabel icon={XCircle} label="Decline Reason" isLight={isLight} />
          <div
            className={cn(
              cardStyle,
              isLight ? 'border-red-200 bg-red-50/50' : 'border-red-900/40 bg-red-900/10'
            )}
          >
            <p className={cn('text-sm font-medium', isLight ? 'text-red-700' : 'text-red-400')}>
              {humanizeReason(returnItem.declineReason)}
            </p>
            {returnItem.declineNote && (
              <p className="text-xs text-stone-500 italic mt-1">
                &ldquo;{returnItem.declineNote}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Return Line Items */}
      {returnItem.returnLineItems.length > 0 && (
        <div>
          <SectionLabel
            icon={Package}
            label="Items being returned"
            count={returnItem.returnLineItems.length}
            isLight={isLight}
          />
          <div className="space-y-1">
            {returnItem.returnLineItems.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 py-2 px-2 rounded text-sm',
                  i % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : ''
                )}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className={cn(
                      'w-8 h-8 rounded flex-shrink-0 flex items-center justify-center',
                      isLight ? 'bg-stone-100' : 'bg-white/[0.06]'
                    )}
                  >
                    <Package className="w-3.5 h-3.5 text-stone-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-medium truncate',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-stone-500">
                    {item.sku && <span className="font-mono mr-2">{item.sku}</span>}
                    <span>Qty: {item.quantity}</span>
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  {item.returnReason && (
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 font-medium',
                        isLight ? 'bg-stone-100 text-stone-700' : 'bg-white/[0.06] text-stone-300'
                      )}
                    >
                      {humanizeReason(item.returnReason)}
                    </span>
                  )}
                  {item.restockingFeeAmount > 0 && (
                    <span className="text-[10px] text-stone-500">
                      Restock fee: {fmt(item.restockingFeeAmount, cur)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {/* Show notes for items that have them */}
            {returnItem.returnLineItems.some((li) => li.customerNote || li.returnReasonNote) && (
              <div
                className={cn('mt-2 space-y-1 px-2', isLight ? 'text-stone-700' : 'text-stone-300')}
              >
                {returnItem.returnLineItems
                  .filter((li) => li.customerNote || li.returnReasonNote)
                  .map((li) => (
                    <p key={`note-${li.id}`} className="text-xs italic text-stone-500">
                      &ldquo;{li.customerNote || li.returnReasonNote}&rdquo;
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exchange Line Items */}
      {returnItem.exchangeLineItems.length > 0 && (
        <div>
          <SectionLabel
            icon={ArrowRightLeft}
            label="Exchange items going out"
            count={returnItem.exchangeLineItems.length}
            isLight={isLight}
          />
          <div className="space-y-1">
            {returnItem.exchangeLineItems.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 py-2 px-2 rounded text-sm',
                  i % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : ''
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded flex-shrink-0 flex items-center justify-center',
                    isLight ? 'bg-emerald-50' : 'bg-emerald-900/20'
                  )}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-medium truncate',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-stone-500">
                    {item.sku && <span className="font-mono mr-2">{item.sku}</span>}
                    <span>Qty: {item.quantity}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      'font-mono tabular-nums text-xs font-medium',
                      isLight ? 'text-emerald-700' : 'text-emerald-400'
                    )}
                  >
                    {fmt(item.unitPrice, cur)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reverse Fulfillments */}
      {returnItem.reverseFulfillments.length > 0 && (
        <div>
          <SectionLabel
            icon={Truck}
            label="Inbound shipping"
            count={returnItem.reverseFulfillments.length}
            isLight={isLight}
          />
          <div className="space-y-2">
            {returnItem.reverseFulfillments.map((rf) => (
              <div key={rf.id} className={cn(cardStyle, 'flex items-center justify-between')}>
                <div className="flex items-center gap-3">
                  <RotateCcw
                    className={cn(
                      'w-4 h-4 flex-shrink-0',
                      rf.status === 'CLOSED' || rf.status === 'COMPLETED'
                        ? 'text-emerald-500'
                        : 'text-stone-500'
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        'text-xs font-medium uppercase tracking-wider',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {rf.status.toLowerCase().replace(/_/g, ' ')}
                    </p>
                    {rf.trackingCompany && (
                      <p className="text-xs text-stone-500">{rf.trackingCompany}</p>
                    )}
                  </div>
                </div>
                {rf.trackingNumber && (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-mono',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {rf.trackingNumber}
                    </span>
                    {rf.trackingUrl && (
                      <a
                        href={rf.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          isLight
                            ? 'text-blue-600 hover:text-blue-700'
                            : 'text-blue-400 hover:text-blue-300'
                        )}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
