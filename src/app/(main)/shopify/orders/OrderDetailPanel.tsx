'use client'

import { useShopifyOrderDetail } from '../hooks/useShopifyData'
import type { ShopifyOrderDetail } from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  ShieldAlert,
  Clock,
  MapPin,
  User,
  ExternalLink,
  X,
} from 'lucide-react'

function fmt(amount: string | number, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function fmtDate(dateStr: string, timeZone?: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone && { timeZone }),
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

export function OrderDetailPanel({
  orderId,
  isLight,
  currency,
  storeTimezone,
  onClose,
}: {
  orderId: number
  isLight: boolean
  currency: string
  storeTimezone?: string
  onClose: () => void
}) {
  const { data: order, isLoading, error } = useShopifyOrderDetail(String(orderId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading order details...</span>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load order details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const cur = order.totalPriceSet?.shopMoney?.currencyCode || currency

  const lineItems = order.lineItems?.edges?.map((e: any) => e.node) ?? []
  const transactions = order.transactions ?? []
  const fulfillments = order.fulfillments ?? []
  const refunds = order.refunds ?? []
  const risks = order.risks ?? []
  const events = order.events?.edges?.map((e: any) => e.node) ?? []

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
              {fmtDate(order.createdAt, storeTimezone)}
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
        {/* Customer */}
        {order.customer && (
          <div className={cardStyle}>
            <h3
              className={cn(
                'text-xs font-medium uppercase tracking-wider',
                isLight ? 'text-stone-500' : 'text-stone-500'
              )}
            >
              Customer
            </h3>
            <div className="space-y-2 text-sm">
              <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {order.customer.displayName}
              </p>
              {order.customer.email && <p className="text-stone-500">{order.customer.email}</p>}
              {order.customer.phone && <p className="text-stone-500">{order.customer.phone}</p>}
              <div className="flex justify-between">
                <span className="text-stone-500">Lifetime Orders</span>
                <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                  {order.customer.numberOfOrders}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Lifetime Spend</span>
                <span
                  className={cn(
                    'font-mono text-xs font-medium',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {fmt(order.customer.amountSpent.amount, order.customer.amountSpent.currencyCode)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Shipping Address */}
        {order.shippingAddress && (
          <div className={cardStyle}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Shipping Address
            </h3>
            <div className="text-sm text-stone-500 space-y-0.5">
              {order.shippingAddress.formatted.map((line: string, i: number) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* Financial Summary Card */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Financial Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Subtotal</span>
              <span
                className={cn('font-mono tabular-nums', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmt(order.subtotalPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>
            {parseFloat(order.totalDiscountsSet?.shopMoney?.amount ?? '0') > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Discounts</span>
                <span className={isLight ? 'text-red-600' : 'text-red-400'}>
                  -{fmt(order.totalDiscountsSet.shopMoney.amount, cur)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Shipping</span>
              <span
                className={cn('font-mono tabular-nums', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmt(order.totalShippingPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Tax</span>
              <span
                className={cn('font-mono tabular-nums', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmt(order.totalTaxSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>
            <div
              className={cn(
                'flex justify-between font-semibold pt-1 border-t',
                isLight ? 'border-stone-200' : 'border-white/[0.08]'
              )}
            >
              <span className={isLight ? 'text-stone-900' : 'text-white'}>Total</span>
              <span
                className={cn('font-mono tabular-nums', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmt(order.totalPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>
            {parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? '0') > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Refunded</span>
                <span className={isLight ? 'text-red-600' : 'text-red-400'}>
                  -{fmt(order.totalRefundedSet.shopMoney.amount, cur)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div>
          <SectionLabel
            icon={Package}
            label="Line Items"
            count={lineItems.length}
            isLight={isLight}
          />
          <div className="space-y-1.5">
            {lineItems.map((item: any) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 py-1.5 px-2 rounded text-sm',
                  isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                )}
              >
                {item.variant?.image?.url && (
                  <img
                    src={item.variant.image.url}
                    alt={item.title}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
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
                    {item.variant?.sku && (
                      <span className="font-mono mr-2">{item.variant.sku}</span>
                    )}
                    {item.variant?.title && item.variant.title !== 'Default Title' && (
                      <span>{item.variant.title}</span>
                    )}
                  </p>
                </div>
                <span className="text-stone-500 text-sm">&times;{item.quantity}</span>
                <span
                  className={cn(
                    'font-mono tabular-nums text-sm font-medium w-24 text-right',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {fmt(item.originalTotalSet?.shopMoney?.amount ?? '0', cur)}
                </span>
                {item.fulfillmentStatus && (
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                      item.fulfillmentStatus === 'FULFILLED'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    )}
                  >
                    {item.fulfillmentStatus.toLowerCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions + Fulfillments + Refunds row */}
      <div className="grid grid-cols-1 @lg:grid-cols-3 gap-4">
        {/* Transactions */}
        {transactions.length > 0 && (
          <div className={cardStyle}>
            <SectionLabel
              icon={CreditCard}
              label="Transactions"
              count={transactions.length}
              isLight={isLight}
            />
            <div className="space-y-1.5">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
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
        )}

        {/* Fulfillments */}
        {fulfillments.length > 0 && (
          <div className={cardStyle}>
            <SectionLabel
              icon={Truck}
              label="Fulfillments"
              count={fulfillments.length}
              isLight={isLight}
            />
            <div className="space-y-2">
              {fulfillments.map((f: any) => (
                <div key={f.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                        f.status === 'SUCCESS'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      )}
                    >
                      {f.displayStatus || f.status}
                    </span>
                    <span className="text-xs text-stone-500">
                      {fmtDate(f.createdAt, storeTimezone)}
                    </span>
                  </div>
                  {f.trackingInfo?.map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-stone-500">
                      {t.company && <span>{t.company}</span>}
                      {t.number && (
                        <span className="font-mono">
                          {t.url ? (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'inline-flex items-center gap-0.5',
                                isLight
                                  ? 'text-blue-600 hover:text-blue-700'
                                  : 'text-blue-400 hover:text-blue-300'
                              )}
                            >
                              {t.number}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            t.number
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                  {f.deliveredAt && (
                    <p className="text-xs text-emerald-500">
                      Delivered {fmtDate(f.deliveredAt, storeTimezone)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refunds */}
        {refunds.length > 0 && (
          <div className={cardStyle}>
            <SectionLabel
              icon={RotateCcw}
              label="Refunds"
              count={refunds.length}
              isLight={isLight}
            />
            <div className="space-y-2">
              {refunds.map((r: any) => (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-500">
                      {fmtDate(r.createdAt, storeTimezone)}
                    </span>
                    <span
                      className={cn(
                        'font-mono tabular-nums text-sm font-medium',
                        isLight ? 'text-red-600' : 'text-red-400'
                      )}
                    >
                      -{fmt(r.totalRefundedSet?.shopMoney?.amount ?? '0', cur)}
                    </span>
                  </div>
                  {r.note && <p className="text-xs text-stone-500 italic">{r.note}</p>}
                  {r.refundLineItems?.edges?.map((e: any, i: number) => (
                    <p key={i} className="text-xs text-stone-500">
                      {e.node.lineItem?.title} &times;{e.node.quantity}
                      {e.node.restockType !== 'NO_RESTOCK' && (
                        <span className="text-emerald-500 ml-1">(restocked)</span>
                      )}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Risks */}
      {risks.length > 0 && risks.some((r: any) => r.level !== 'NONE') && (
        <div>
          <SectionLabel icon={ShieldAlert} label="Risk Assessment" isLight={isLight} />
          <div className="space-y-1">
            {risks
              .filter((r: any) => r.level !== 'NONE')
              .map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                      r.level === 'HIGH'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : r.level === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    )}
                  >
                    {r.level}
                  </span>
                  {r.message && <span className="text-stone-500 text-xs">{r.message}</span>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Timeline Events */}
      {events.length > 0 && (
        <div>
          <SectionLabel icon={Clock} label="Timeline" count={events.length} isLight={isLight} />
          <div className="max-h-[300px] overflow-y-auto">
            {events.map((e: any, i: number) => {
              const date = new Date(e.createdAt)
              const tzOpts = storeTimezone ? { timeZone: storeTimezone } : {}
              const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                ...tzOpts,
              })
              const timeStr = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                ...tzOpts,
              })
              const prevDate =
                i > 0
                  ? new Date(events[i - 1].createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      ...tzOpts,
                    })
                  : null
              const showDateHeader = i === 0 || dateStr !== prevDate
              const isLast = i === events.length - 1

              return (
                <div key={i}>
                  {showDateHeader && (
                    <div className="relative py-2 pl-5">
                      {/* Line through date header */}
                      <div
                        className={cn(
                          'absolute left-[3.5px] top-0 bottom-0 w-px',
                          isLight ? 'bg-stone-200' : 'bg-white/[0.08]'
                        )}
                      />
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wider',
                          isLight ? 'text-stone-500' : 'text-stone-400'
                        )}
                      >
                        {dateStr}
                      </span>
                    </div>
                  )}
                  <div className="relative flex items-start gap-3 py-1.5 group">
                    {/* Line segment — runs full height of this row */}
                    <div
                      className={cn(
                        'absolute left-[3.5px] top-0 bottom-0 w-px',
                        isLight ? 'bg-stone-200' : 'bg-white/[0.08]'
                      )}
                    />
                    {/* Dot */}
                    <div
                      className={cn(
                        'relative z-10 mt-[5px] w-2 h-2 rounded-full flex-shrink-0',
                        isLight
                          ? 'bg-stone-300 group-hover:bg-stone-400'
                          : 'bg-stone-600 group-hover:bg-stone-500'
                      )}
                    />
                    {/* Time */}
                    <span
                      className={cn(
                        'text-[11px] font-mono tabular-nums whitespace-nowrap w-20 flex-shrink-0 mt-[2px]',
                        isLight ? 'text-stone-400' : 'text-stone-500'
                      )}
                    >
                      {timeStr}
                    </span>
                    {/* Message */}
                    <span
                      className={cn(
                        'text-xs leading-relaxed mt-[2px]',
                        isLight ? 'text-stone-600' : 'text-stone-400'
                      )}
                    >
                      {e.message}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Note + Tags */}
      {(order.note || (order.tags && order.tags.length > 0)) && (
        <div className={cn(cardStyle, 'flex flex-wrap gap-6')}>
          {order.note && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Note
              </p>
              <p className="text-sm text-stone-500 italic">{order.note}</p>
            </div>
          )}
          {order.tags && order.tags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {order.tags.map((tag: string) => (
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
