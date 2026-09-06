'use client'

import { useShopifyRefundDetail } from '../hooks/useShopifyData'
import type {
  ShopifyRefundDetailEntry,
  ShopifyRefundDetailLineItem,
} from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Package,
  CreditCard,
  RotateCcw,
  CornerDownRight,
  MapPin,
  FileText,
  X,
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
    hour: 'numeric',
    minute: '2-digit',
  })
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
  const s = status.toUpperCase()
  const colorMap: Record<string, string> = {
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    PARTIALLY_REFUNDED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    REFUNDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    PENDING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    AUTHORIZED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    VOIDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    FULFILLED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    UNFULFILLED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PARTIALLY_FULFILLED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    DECLINED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const color =
    colorMap[s] || (isLight ? 'bg-stone-100 text-stone-700' : 'bg-white/[0.08] text-stone-300')
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 font-medium',
        color
      )}
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  )
}

function RestockBadge({ type }: { type: string }) {
  const t = type.toUpperCase()
  const map: Record<string, { cls: string; label: string }> = {
    RETURN: {
      cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      label: 'Restocked',
    },
    LEGACY_RESTOCK: {
      cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      label: 'Restocked',
    },
    NO_RESTOCK: {
      cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      label: 'Not restocked',
    },
    CANCEL: {
      cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      label: 'Cancelled',
    },
  }
  const entry = map[t] || map.NO_RESTOCK
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 font-medium',
        entry.cls
      )}
    >
      {entry.label}
    </span>
  )
}

/** Extract the numeric part from a Shopify GID (e.g. "gid://shopify/Refund/123" -> 123) */
function numericGid(gid: string): number {
  const match = gid.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

export function RefundDetailPanel({
  orderId,
  refundId,
  isLight,
  currency,
  onClose,
}: {
  orderId: number
  refundId: number
  isLight: boolean
  currency: string
  onClose: () => void
}) {
  const { data: order, isLoading, error } = useShopifyRefundDetail(String(orderId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading refund details...</span>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load refund details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  // Find the specific refund by matching refundId against the numeric GID
  const refund: ShopifyRefundDetailEntry | undefined = order.refunds.find(
    (r) => numericGid(r.id) === refundId
  )

  if (!refund) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">Refund not found in order data.</p>
      </div>
    )
  }

  const cur = order.totalPriceSet?.shopMoney?.currencyCode || currency
  const refundLineItems = refund.refundLineItems?.edges?.map((e) => e.node) ?? []
  const transactions = refund.transactions?.edges?.map((e: any) => e.node) ?? []
  const returnInfo = refund.return
  const returnLineItems = returnInfo?.returnLineItems?.edges?.map((e) => e.node) ?? []

  const cardStyle = cn(
    'rounded-lg border p-4 space-y-3',
    isLight
      ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
      : 'bg-white/[0.02] border-[var(--theme-card-border)]'
  )

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
                'text-lg font-semibold tracking-tight',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {order.name}
            </h2>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
              Refunded {fmtDate(refund.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {order.displayFinancialStatus && (
              <StatusBadge status={order.displayFinancialStatus} isLight={isLight} />
            )}
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
              {order.name}
            </p>
            <p className="text-xs text-stone-500">{fmtDate(order.createdAt)}</p>
            {order.customer && (
              <>
                <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                  {order.customer.displayName}
                </p>
                {order.customer.email && <p className="text-stone-500">{order.customer.email}</p>}
                {order.customer.phone && <p className="text-stone-500">{order.customer.phone}</p>}
              </>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Order Total</span>
              <span
                className={cn(
                  'font-mono tabular-nums text-xs font-medium',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {fmt(order.totalPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {order.displayFinancialStatus && (
                <StatusBadge status={order.displayFinancialStatus} isLight={isLight} />
              )}
              {order.displayFulfillmentStatus && (
                <StatusBadge status={order.displayFulfillmentStatus} isLight={isLight} />
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Refund Summary */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Refund Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Total Refunded</span>
              <span
                className={cn(
                  'font-mono tabular-nums font-semibold',
                  isLight ? 'text-red-600' : 'text-red-400'
                )}
              >
                {fmt(refund.totalRefundedSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Items Refunded</span>
              <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {refundLineItems.length}
              </span>
            </div>
            {refund.note && (
              <div>
                <span className="text-stone-500 text-xs">Note</span>
                <p
                  className={cn(
                    'text-xs mt-0.5 italic',
                    isLight ? 'text-stone-700' : 'text-stone-300'
                  )}
                >
                  {refund.note}
                </p>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Processed</span>
              <span className="text-stone-500 text-xs">{fmtDate(refund.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Payment Transactions */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Payment Transactions
          </h3>
          <div className="space-y-2 text-sm">
            {transactions.length === 0 && (
              <p className="text-xs text-stone-500">No transactions recorded.</p>
            )}
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div>
                  <span
                    className={cn(
                      'capitalize font-medium',
                      tx.status === 'SUCCESS' || tx.status === 'success'
                        ? isLight
                          ? 'text-emerald-600'
                          : 'text-emerald-400'
                        : tx.status === 'FAILURE' || tx.status === 'failure'
                          ? isLight
                            ? 'text-red-600'
                            : 'text-red-400'
                          : isLight
                            ? 'text-stone-900'
                            : 'text-white'
                    )}
                  >
                    {tx.kind}
                  </span>
                  <span className="text-stone-500 ml-1.5 text-xs">
                    {tx.formattedGateway || tx.gateway}
                  </span>
                </div>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {fmt(tx.amountSet?.shopMoney?.amount ?? '0', cur)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refund Line Items */}
      {refundLineItems.length > 0 && (
        <div>
          <SectionLabel
            icon={Package}
            label="Refunded Items"
            count={refundLineItems.length}
            isLight={isLight}
          />
          <div className="space-y-1">
            {refundLineItems.map((item: ShopifyRefundDetailLineItem, i: number) => {
              const imgUrl = item.lineItem?.image?.url || item.lineItem?.variant?.image?.url || null
              return (
                <div
                  key={item.lineItem?.id || i}
                  className={cn(
                    'flex items-center gap-3 py-2 px-2 rounded text-sm',
                    i % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : ''
                  )}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item.lineItem?.title ?? ''}
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
                      {item.lineItem?.title}
                    </p>
                    <p className="text-xs text-stone-500">
                      {(item.lineItem?.sku || item.lineItem?.variant?.sku) && (
                        <span className="font-mono mr-2">
                          {item.lineItem?.sku || item.lineItem?.variant?.sku}
                        </span>
                      )}
                      <span>
                        Qty: {item.lineItem?.quantity ?? '-'} &rarr; refunded {item.quantity}
                      </span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    {item.subtotalSet && (
                      <p
                        className={cn(
                          'font-mono tabular-nums text-xs font-medium',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {fmt(item.subtotalSet.shopMoney.amount, cur)}
                      </p>
                    )}
                    {item.totalTaxSet && parseFloat(item.totalTaxSet.shopMoney.amount) > 0 && (
                      <p className="font-mono tabular-nums text-[10px] text-stone-500">
                        +{fmt(item.totalTaxSet.shopMoney.amount, cur)} tax
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <RestockBadge type={item.restockType} />
                    {item.location && (
                      <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {item.location.name}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Return Info */}
      {returnInfo && (
        <div>
          <SectionLabel icon={CornerDownRight} label="Return Info" isLight={isLight} />
          <div className={cardStyle}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-stone-500">Return Status</span>
              <StatusBadge status={returnInfo.status} isLight={isLight} />
            </div>
            {returnLineItems.length > 0 && (
              <div className="space-y-2">
                {returnLineItems.map((rli) => (
                  <div
                    key={rli.id}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm space-y-1',
                      isLight ? 'bg-stone-50' : 'bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                        Item (qty: {rli.quantity})
                      </p>
                      <span className="text-stone-500 text-xs">&times;{rli.quantity}</span>
                    </div>
                    {rli.returnReason && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-stone-500">Reason:</span>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            isLight ? 'text-stone-800' : 'text-stone-200'
                          )}
                        >
                          {rli.returnReason.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {rli.returnReasonNote && (
                      <p className="text-xs text-stone-500 italic">
                        &ldquo;{rli.returnReasonNote}&rdquo;
                      </p>
                    )}
                    {rli.customerNote && (
                      <p className="text-xs text-stone-500">
                        <span className="font-medium">Customer note:</span> {rli.customerNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund Note */}
      {refund.note && (
        <div className={cn(cardStyle, 'flex flex-wrap gap-6')}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              <FileText className="w-3 h-3 inline mr-1" />
              Refund Note
            </p>
            <p className="text-sm text-stone-500 italic">{refund.note}</p>
          </div>
        </div>
      )}
    </div>
  )
}
