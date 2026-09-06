'use client'

import { useShopifyDraftOrderDetail } from '../hooks/useShopifyData'
import type { ShopifyDraftOrderDetail } from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Package,
  User,
  Truck,
  DollarSign,
  ExternalLink,
  X,
  Tag,
  StickyNote,
  Database,
  Building2,
  Clock,
  CheckCircle2,
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
  const normalized = status.toLowerCase()
  const colorMap: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    invoice_sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }
  const color =
    colorMap[normalized] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        color
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function DraftOrderDetailPanel({
  draftOrderId,
  isLight,
  onClose,
}: {
  draftOrderId: number
  isLight: boolean
  onClose: () => void
}) {
  const { data: draft, isLoading, error } = useShopifyDraftOrderDetail(String(draftOrderId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading draft order details...</span>
      </div>
    )
  }

  if (error || !draft) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load draft order details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const cur = draft.currencyCode || 'USD'
  const lineItems = draft.lineItems?.edges?.map((e: any) => e.node) ?? []
  const metafields = draft.metafields?.edges?.map((e: any) => e.node) ?? []
  const taxLines = draft.taxLines ?? []

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
            <div className="flex items-center gap-3">
              <h2
                className={cn(
                  'text-lg font-semibold tracking-tight',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {draft.name}
              </h2>
              <StatusBadge status={draft.status} isLight={isLight} />
              {draft.ready && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                </span>
              )}
              {draft.purchasingEntity?.company && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Building2 className="w-2.5 h-2.5" /> B2B
                </span>
              )}
            </div>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
              {fmtDate(draft.createdAt)}
              {draft.totalQuantityOfLineItems != null && (
                <span className="ml-3 text-stone-500 rounded px-1">
                  {draft.totalQuantityOfLineItems} units
                </span>
              )}
            </p>
            {draft.invoiceUrl && (
              <a
                href={draft.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 text-xs mt-1.5',
                  isLight
                    ? 'text-blue-600 hover:text-blue-700'
                    : 'text-blue-400 hover:text-blue-300'
                )}
              >
                View Invoice
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
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
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Customer</h3>
          {draft.customer ? (
            <div className="space-y-2 text-sm">
              <p className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {draft.customer.displayName}
              </p>
              {draft.customer.email && <p className="text-stone-500">{draft.customer.email}</p>}
              {draft.customer.phone && <p className="text-stone-500">{draft.customer.phone}</p>}
              <div className="flex justify-between">
                <span className="text-stone-500">Lifetime Orders</span>
                <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                  {draft.customer.numberOfOrders}
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
                  {fmt(draft.customer.amountSpent.amount, draft.customer.amountSpent.currencyCode)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500 italic">No customer</p>
          )}
        </div>

        {/* Shipping */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">Shipping</h3>
          <div className="space-y-3 text-sm">
            {draft.shippingAddress ? (
              <div className="text-stone-500 space-y-0.5">
                {draft.shippingAddress.formatted.map((line: string, i: number) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="text-stone-500 italic">No shipping address</p>
            )}
            {draft.shippingLine && (
              <div className="flex justify-between">
                <span className="text-stone-500">{draft.shippingLine.title}</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {fmt(draft.shippingLine.originalPriceSet?.shopMoney?.amount ?? '0', cur)}
                </span>
              </div>
            )}
            {draft.billingAddress &&
              JSON.stringify(draft.billingAddress) !== JSON.stringify(draft.shippingAddress) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                    Billing Address
                  </p>
                  <div className="text-stone-500 space-y-0.5">
                    {draft.billingAddress.formatted.map((line: string, i: number) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* B2B & Payment Terms */}
        {(draft.purchasingEntity?.company || draft.paymentTerms || draft.poNumber) && (
          <div className={cardStyle}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
              B2B & Payment Terms
            </h3>
            <div className="space-y-2 text-sm">
              {draft.purchasingEntity?.company && (
                <>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Company</span>
                    <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                      {draft.purchasingEntity.company.name}
                    </span>
                  </div>
                  {draft.purchasingEntity.location && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Location</span>
                      <span className="text-stone-500">{draft.purchasingEntity.location.name}</span>
                    </div>
                  )}
                </>
              )}
              {draft.poNumber && (
                <div className="flex justify-between">
                  <span className="text-stone-500">PO Number</span>
                  <span
                    className={cn(
                      'font-mono text-xs font-medium',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}
                  >
                    {draft.poNumber}
                  </span>
                </div>
              )}
              {draft.paymentTerms && (
                <>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Terms</span>
                    <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                      {draft.paymentTerms.paymentTermsName}
                    </span>
                  </div>
                  {draft.paymentTerms.dueInDays != null && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Due in</span>
                      <span className="text-stone-500">{draft.paymentTerms.dueInDays} days</span>
                    </div>
                  )}
                  {draft.paymentTerms.overdue && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Status</span>
                      <span className="text-red-500 font-medium">Overdue</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Financial Summary */}
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
                {fmt(draft.subtotalPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>

            {draft.appliedDiscount && (
              <div className="flex justify-between">
                <span className="text-stone-500">
                  Discount
                  {draft.appliedDiscount.title && (
                    <span className="ml-1 text-xs">({draft.appliedDiscount.title})</span>
                  )}
                </span>
                <span className={isLight ? 'text-red-600' : 'text-red-400'}>
                  {draft.appliedDiscount.amountSet?.shopMoney?.amount
                    ? `-${fmt(draft.appliedDiscount.amountSet.shopMoney.amount, cur)}`
                    : draft.appliedDiscount.valueType === 'PERCENTAGE'
                      ? `-${draft.appliedDiscount.value}%`
                      : `-${fmt(draft.appliedDiscount.value, cur)}`}
                </span>
              </div>
            )}

            {parseFloat(draft.totalDiscountsSet?.shopMoney?.amount ?? '0') > 0 &&
              !draft.appliedDiscount && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Discounts</span>
                  <span className={isLight ? 'text-red-600' : 'text-red-400'}>
                    -{fmt(draft.totalDiscountsSet!.shopMoney.amount, cur)}
                  </span>
                </div>
              )}

            <div className="flex justify-between">
              <span className="text-stone-500">Shipping</span>
              <span
                className={cn('font-mono tabular-nums', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmt(draft.totalShippingPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-stone-500">Tax</span>
              <span
                className={cn('font-mono tabular-nums', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmt(draft.totalTaxSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>

            {taxLines.length > 1 && (
              <div className="pl-3 space-y-1">
                {taxLines.map((tl: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-stone-500">
                      {tl.title} ({(tl.rate * 100).toFixed(1)}%)
                    </span>
                    <span
                      className={cn(
                        'font-mono tabular-nums',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {fmt(tl.priceSet?.shopMoney?.amount ?? '0', cur)}
                    </span>
                  </div>
                ))}
              </div>
            )}

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
                {fmt(draft.totalPriceSet?.shopMoney?.amount ?? '0', cur)}
              </span>
            </div>

            {draft.order && (
              <div className="flex justify-between pt-1">
                <span className="text-stone-500">Converted to order</span>
                <span
                  className={cn('font-medium', isLight ? 'text-emerald-600' : 'text-emerald-400')}
                >
                  {draft.order.name}
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
          <div className="space-y-0.5">
            {lineItems.map((item: any, idx: number) => {
              const imgUrl = item.image?.url ?? item.variant?.image?.url
              const originalPrice = item.originalUnitPriceSet?.shopMoney?.amount ?? '0'
              const discountedPrice = item.discountedUnitPriceSet?.shopMoney?.amount
              const hasLineDiscount =
                discountedPrice && parseFloat(discountedPrice) < parseFloat(originalPrice)

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 py-2 px-2 rounded text-sm',
                    idx % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                    isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                  )}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
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
                      {item.variantTitle && item.variantTitle !== 'Default Title' && (
                        <span className="mr-2">{item.variantTitle}</span>
                      )}
                      {item.vendor && <span className="mr-2">{item.vendor}</span>}
                    </p>
                    {(item.sku || item.variant?.sku) && (
                      <p className="text-[11px] font-mono text-stone-400">
                        {item.sku || item.variant?.sku}
                      </p>
                    )}
                  </div>

                  <span className="text-stone-500 text-sm whitespace-nowrap">
                    &times;{item.quantity}
                  </span>

                  <div className="w-28 text-right flex-shrink-0">
                    {hasLineDiscount ? (
                      <>
                        <span className="text-stone-400 line-through text-xs font-mono mr-1">
                          {fmt(originalPrice, cur)}
                        </span>
                        <span
                          className={cn(
                            'font-mono tabular-nums text-sm font-medium',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          {fmt(discountedPrice, cur)}
                        </span>
                      </>
                    ) : (
                      <span
                        className={cn(
                          'font-mono tabular-nums text-sm font-medium',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {fmt(originalPrice, cur)}
                      </span>
                    )}
                  </div>

                  <div className="w-28 text-right flex-shrink-0 space-y-0.5">
                    {item.appliedDiscount && item.appliedDiscount.amountSet?.shopMoney?.amount && (
                      <p className={cn('text-xs', isLight ? 'text-red-600' : 'text-red-400')}>
                        -{fmt(item.appliedDiscount.amountSet.shopMoney.amount, cur)}
                        {item.appliedDiscount.title && (
                          <span className="text-stone-500 ml-0.5">
                            ({item.appliedDiscount.title})
                          </span>
                        )}
                      </p>
                    )}
                    {item.taxLines?.length > 0 &&
                      item.taxLines.map((tl: any, ti: number) => (
                        <p key={ti} className="text-[10px] text-stone-500">
                          {tl.title} {fmt(tl.priceSet?.shopMoney?.amount ?? '0', cur)}
                        </p>
                      ))}
                  </div>
                </div>
              )
            })}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b text-left',
                    isLight ? 'border-stone-200' : 'border-white/[0.08]'
                  )}
                >
                  <th className="py-1.5 pr-4 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    Namespace
                  </th>
                  <th className="py-1.5 pr-4 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    Key
                  </th>
                  <th className="py-1.5 pr-4 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    Value
                  </th>
                  <th className="py-1.5 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {metafields.map((mf: any, i: number) => (
                  <tr
                    key={i}
                    className={cn('border-b', isLight ? 'border-stone-100' : 'border-white/[0.04]')}
                  >
                    <td
                      className={cn(
                        'py-1.5 pr-4 font-mono text-xs',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {mf.namespace}
                    </td>
                    <td
                      className={cn(
                        'py-1.5 pr-4 font-mono text-xs',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {mf.key}
                    </td>
                    <td className="py-1.5 pr-4 text-stone-500 text-xs max-w-[200px] truncate">
                      {mf.value}
                    </td>
                    <td className="py-1.5 text-stone-500 text-xs font-mono">{mf.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes + Tags */}
      {(draft.note2 || (draft.tags && draft.tags.length > 0)) && (
        <div className={cn(cardStyle, 'flex flex-wrap gap-6')}>
          {draft.note2 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Note
              </p>
              <p className="text-sm text-stone-500 italic">{draft.note2}</p>
            </div>
          )}
          {draft.tags && draft.tags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {draft.tags.map((tag: string) => (
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
