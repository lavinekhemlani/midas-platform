'use client'

import type {
  ShopifyFulfillmentOrderItem,
  ShopifyFulfillmentOrderStatus,
} from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Package,
  Truck,
  Clock,
  AlertTriangle,
  MapPin,
  ExternalLink,
  X,
  MessageSquare,
} from 'lucide-react'

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function humanize(str: string): string {
  return str
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const STATUS_COLORS: Record<ShopifyFulfillmentOrderStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  ON_HOLD: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  INCOMPLETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function StatusBadge({ status }: { status: ShopifyFulfillmentOrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        STATUS_COLORS[status]
      )}
    >
      {humanize(status)}
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

export function FulfillmentDetailPanel({
  item,
  isLight,
  onClose,
}: {
  item: ShopifyFulfillmentOrderItem
  isLight: boolean
  onClose: () => void
}) {
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const cardBg = isLight ? 'bg-stone-50' : 'bg-white/[0.03]'

  return (
    <div className={cn('border-t px-4 py-5 space-y-5', borderClass, cardBg)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold theme-text-primary">{item.orderName}</span>
            <StatusBadge status={item.status} />
            {item.slaBreach && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="w-2.5 h-2.5" /> SLA Breach
              </span>
            )}
          </div>
          <div className="text-xs theme-text-secondary mt-1">
            Created {fmtDate(item.createdAt)}
            {item.fulfillBy && (
              <span className="ml-3">
                Due by {fmtDate(item.fulfillBy)}
                {item.slaHoursRemaining !== null && (
                  <span
                    className={cn(
                      'ml-1 font-mono',
                      item.slaHoursRemaining < 0
                        ? 'text-red-500'
                        : item.slaHoursRemaining < 24
                          ? 'text-amber-500'
                          : 'text-green-500'
                    )}
                  >
                    ({item.slaHoursRemaining < 0 ? '' : '+'}
                    {Math.round(item.slaHoursRemaining)}h)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded theme-text-secondary hover:theme-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Location + Destination row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {item.assignedLocation && (
          <div>
            <SectionLabel icon={MapPin} label="Assigned Location" isLight={isLight} />
            <p className="text-sm theme-text-primary">{item.assignedLocation}</p>
            {item.assignedLocationCity && (
              <p className="text-xs theme-text-secondary">{item.assignedLocationCity}</p>
            )}
          </div>
        )}
        {item.destination && (
          <div>
            <SectionLabel icon={Truck} label="Ship To" isLight={isLight} />
            <p className="text-sm theme-text-primary">
              {[item.destination.firstName, item.destination.lastName].filter(Boolean).join(' ') ||
                item.destination.company ||
                'Customer'}
            </p>
            <p className="text-xs theme-text-secondary">
              {[item.destination.city, item.destination.province, item.destination.countryCode]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Holds */}
      {item.holds.length > 0 && (
        <div>
          <SectionLabel
            icon={AlertTriangle}
            label="Active Holds"
            count={item.holds.length}
            isLight={isLight}
          />
          <div className="space-y-2">
            {item.holds.map((h, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 px-3 py-2 rounded-[4px] border text-xs',
                  isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-amber-900/10 border-amber-900/30 text-amber-300'
                )}
              >
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">{humanize(h.reason)}</span>
                  {h.reasonNotes && <p className="mt-0.5 opacity-80">{h.reasonNotes}</p>}
                  {h.heldByApp && <p className="mt-0.5 opacity-60">Held by: {h.heldByApp.name}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line Items */}
      <div>
        <SectionLabel
          icon={Package}
          label="Line Items"
          count={item.lineItems.length}
          isLight={isLight}
        />
        <div className={cn('overflow-hidden rounded-[4px] border', borderClass)}>
          <table className="w-full text-xs">
            <thead>
              <tr className={cn('border-b', borderClass)}>
                <th className="text-left py-1.5 px-2 font-medium text-stone-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="text-left py-1.5 px-2 font-medium text-stone-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="text-right py-1.5 px-2 font-medium text-stone-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="text-right py-1.5 px-2 font-medium text-stone-500 uppercase tracking-wider">
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody>
              {item.lineItems.map((li) => (
                <tr key={li.id} className={cn('border-b last:border-b-0', borderClass)}>
                  <td className="py-1.5 px-2 theme-text-primary">
                    <div className="flex items-center gap-2">
                      {li.image && (
                        <img
                          src={li.image.url}
                          alt=""
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div>
                        <div className="truncate max-w-[200px]">{li.productTitle || 'Unknown'}</div>
                        {li.variantTitle && (
                          <div className="text-[10px] theme-text-secondary">{li.variantTitle}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 theme-text-secondary font-mono">{li.sku || '-'}</td>
                  <td className="py-1.5 px-2 text-right theme-text-primary">{li.totalQuantity}</td>
                  <td className="py-1.5 px-2 text-right">
                    <span
                      className={cn(li.remainingQuantity > 0 ? 'text-amber-500' : 'text-green-500')}
                    >
                      {li.remainingQuantity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fulfillments / Tracking */}
      {item.fulfillments.length > 0 && (
        <div>
          <SectionLabel
            icon={Truck}
            label="Shipments"
            count={item.fulfillments.length}
            isLight={isLight}
          />
          <div className="space-y-2">
            {item.fulfillments.map((f) => (
              <div key={f.id} className={cn('px-3 py-2 rounded-[4px] border text-xs', borderClass)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                        f.status === 'SUCCESS'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : f.status === 'CANCELLED'
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      )}
                    >
                      {f.displayStatus ? humanize(f.displayStatus) : f.status}
                    </span>
                    <span className="theme-text-secondary">{fmtDate(f.createdAt)}</span>
                  </div>
                  {item.processingHours !== null && (
                    <span className="font-mono theme-text-secondary">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {item.processingHours < 24
                        ? `${item.processingHours}h`
                        : `${Math.round((item.processingHours / 24) * 10) / 10}d`}
                    </span>
                  )}
                </div>
                {f.trackingInfo.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {f.trackingInfo.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 theme-text-secondary">
                        {t.company && <span>{t.company}</span>}
                        {t.number && <span className="font-mono">{t.number}</span>}
                        {t.url && (
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-0.5"
                          >
                            Track <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-1.5 text-[10px] theme-text-secondary">
                  {f.inTransitAt && <span>In transit: {fmtDate(f.inTransitAt)}</span>}
                  {f.deliveredAt && (
                    <span className="text-green-500">Delivered: {fmtDate(f.deliveredAt)}</span>
                  )}
                  {f.estimatedDeliveryAt && !f.deliveredAt && (
                    <span>ETA: {fmtDate(f.estimatedDeliveryAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merchant Requests (3PL communication) */}
      {item.merchantRequests.length > 0 && (
        <div>
          <SectionLabel
            icon={MessageSquare}
            label="3PL Requests"
            count={item.merchantRequests.length}
            isLight={isLight}
          />
          <div className="space-y-2">
            {item.merchantRequests.map((req, i) => (
              <div key={i} className={cn('px-3 py-2 rounded-[4px] border text-xs', borderClass)}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium',
                      req.kind === 'CANCELLATION_REQUEST' ? 'text-red-500' : 'theme-text-primary'
                    )}
                  >
                    {humanize(req.kind)}
                  </span>
                  <span className="theme-text-secondary">{fmtDate(req.sentAt)}</span>
                </div>
                {req.message && <p className="mt-1 theme-text-secondary">{req.message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported Actions */}
      {item.supportedActions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-stone-500">
            Available actions:
          </span>
          {item.supportedActions.map((action) => (
            <span
              key={action}
              className={cn(
                'px-1.5 py-0.5 text-[10px] rounded-[3px] font-medium',
                isLight ? 'bg-stone-200/60 text-stone-600' : 'bg-white/[0.06] text-stone-400'
              )}
            >
              {humanize(action)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
