'use client'

import { useShopifyInventoryItemDetail } from '../hooks/useShopifyData'
import { cn } from '@/lib/utils'
import { Loader2, MapPin, ExternalLink, X } from 'lucide-react'

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

function InfoRow({
  label,
  value,
  isLight,
  mono,
  strikethrough,
}: {
  label: string
  value: React.ReactNode
  isLight: boolean
  mono?: boolean
  strikethrough?: boolean
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-stone-500 text-sm shrink-0">{label}</span>
      <span
        className={cn(
          'text-sm text-right',
          mono && 'font-mono tabular-nums text-xs',
          strikethrough && 'line-through text-stone-400',
          !strikethrough && (isLight ? 'text-stone-900' : 'text-white')
        )}
      >
        {value}
      </span>
    </div>
  )
}

function StatusBadge({ status, isLight }: { status: string; isLight: boolean }) {
  const colors =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : status === 'DRAFT'
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-stone-100 text-stone-600 dark:bg-stone-800/30 dark:text-stone-400'

  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
        colors
      )}
    >
      {status.toLowerCase()}
    </span>
  )
}

const QUANTITY_CONFIG: Record<
  string,
  { label: string; colorFn: (qty: number, isLight: boolean) => string; alwaysShow: boolean }
> = {
  available: {
    label: 'Available',
    colorFn: (qty, isLight) =>
      qty > 0 ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : 'text-red-500',
    alwaysShow: true,
  },
  on_hand: {
    label: 'On Hand',
    colorFn: (_qty, isLight) => (isLight ? 'text-stone-900' : 'text-white'),
    alwaysShow: true,
  },
  committed: {
    label: 'Committed',
    colorFn: (qty, isLight) =>
      qty > 0
        ? isLight
          ? 'text-amber-600'
          : 'text-amber-400'
        : isLight
          ? 'text-stone-900'
          : 'text-white',
    alwaysShow: true,
  },
  incoming: {
    label: 'Incoming',
    colorFn: (qty, isLight) =>
      qty > 0
        ? isLight
          ? 'text-blue-600'
          : 'text-blue-400'
        : isLight
          ? 'text-stone-900'
          : 'text-white',
    alwaysShow: true,
  },
  reserved: {
    label: 'Reserved',
    colorFn: (_qty, isLight) => (isLight ? 'text-stone-900' : 'text-white'),
    alwaysShow: false,
  },
  damaged: {
    label: 'Damaged',
    colorFn: () => 'text-red-500',
    alwaysShow: false,
  },
  quality_control: {
    label: 'Quality Control',
    colorFn: (_qty, isLight) => (isLight ? 'text-stone-900' : 'text-white'),
    alwaysShow: false,
  },
  safety_stock: {
    label: 'Safety Stock',
    colorFn: (_qty, isLight) => (isLight ? 'text-stone-900' : 'text-white'),
    alwaysShow: false,
  },
}

export function InventoryDetailPanel({
  inventoryItemId,
  isLight,
  onClose,
}: {
  inventoryItemId: number
  isLight: boolean
  onClose: () => void
}) {
  const { data: item, isLoading, error } = useShopifyInventoryItemDetail(String(inventoryItemId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading inventory details...</span>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load inventory details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const variant = item.variant
  const product = variant?.product ?? null
  const image = variant?.image ?? product?.featuredImage ?? null
  const currency = item.unitCost?.currencyCode ?? 'USD'

  const inventoryLevels = item.inventoryLevels?.edges?.map((e) => e.node) ?? []
  const hsEdges = item.countryHarmonizedSystemCodes?.edges ?? []

  const hasCustomsData =
    item.countryCodeOfOrigin ||
    item.provinceCodeOfOrigin ||
    item.harmonizedSystemCode ||
    hsEdges.length > 0

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
          <div className="flex items-start gap-4 min-w-0">
            {image && (
              <img
                src={image.url}
                alt={image.altText || product?.title || 'Product'}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h2
                className={cn(
                  'text-lg font-semibold tracking-tight truncate',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {product?.title ?? `Inventory Item #${inventoryItemId}`}
              </h2>
              {variant?.title && variant.title !== 'Default Title' && (
                <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
                  {variant.title}
                </p>
              )}
              {(item.sku || variant?.sku) && (
                <p className="text-xs font-mono text-stone-500 mt-1">
                  SKU: {item.sku || variant?.sku}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors flex-shrink-0',
              isLight ? 'hover:bg-stone-100 text-stone-400' : 'hover:bg-white/[0.06] text-stone-500'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
        {/* Card 1: Product Info */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Product Info
          </h3>
          <div className="space-y-2 text-sm">
            {product && (
              <>
                <InfoRow label="Product" value={product.title} isLight={isLight} />
                {product.vendor && (
                  <InfoRow label="Vendor" value={product.vendor} isLight={isLight} />
                )}
                {product.productType && (
                  <InfoRow label="Type" value={product.productType} isLight={isLight} />
                )}
                <InfoRow label="Handle" value={product.handle} isLight={isLight} mono />
              </>
            )}
            {variant && (
              <>
                {variant.title && variant.title !== 'Default Title' && (
                  <InfoRow label="Variant" value={variant.title} isLight={isLight} />
                )}
                {variant.selectedOptions?.length > 0 && (
                  <InfoRow
                    label="Options"
                    value={variant.selectedOptions.map((o) => `${o.name}: ${o.value}`).join(', ')}
                    isLight={isLight}
                  />
                )}
                {variant.barcode && (
                  <InfoRow label="Barcode" value={variant.barcode} isLight={isLight} mono />
                )}
                <InfoRow
                  label="Price"
                  value={fmt(variant.price, currency)}
                  isLight={isLight}
                  mono
                />
                {variant.compareAtPrice && (
                  <InfoRow
                    label="Compare At"
                    value={fmt(variant.compareAtPrice, currency)}
                    isLight={isLight}
                    mono
                    strikethrough
                  />
                )}
              </>
            )}
            {product?.onlineStoreUrl && (
              <div className="flex justify-between gap-2">
                <span className="text-stone-500 text-sm">Store URL</span>
                <a
                  href={product.onlineStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 text-sm',
                    isLight
                      ? 'text-blue-600 hover:text-blue-700'
                      : 'text-blue-400 hover:text-blue-300'
                  )}
                >
                  View
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {product?.status && (
              <div className="flex justify-between items-center gap-2 pt-1">
                <span className="text-stone-500 text-sm">Status</span>
                <StatusBadge status={product.status} isLight={isLight} />
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Inventory Tracking */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Inventory Tracking
          </h3>
          <div className="space-y-2 text-sm">
            <InfoRow label="Tracked" value={item.tracked ? 'Yes' : 'No'} isLight={isLight} />
            <InfoRow
              label="Requires Shipping"
              value={item.requiresShipping ? 'Yes' : 'No'}
              isLight={isLight}
            />
            {item.unitCost && (
              <InfoRow
                label="Unit Cost"
                value={fmt(item.unitCost.amount, item.unitCost.currencyCode)}
                isLight={isLight}
                mono
              />
            )}
            {item.measurement?.weight && (
              <InfoRow
                label="Weight"
                value={`${item.measurement.weight.value} ${item.measurement.weight.unit.toLowerCase()}`}
                isLight={isLight}
              />
            )}
            <InfoRow label="Created" value={fmtDate(item.createdAt)} isLight={isLight} />
            <InfoRow label="Updated" value={fmtDate(item.updatedAt)} isLight={isLight} />
          </div>
        </div>

        {/* Card 3: Customs & Trade */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Customs &amp; Trade
          </h3>
          {hasCustomsData ? (
            <div className="space-y-2 text-sm">
              {item.countryCodeOfOrigin && (
                <InfoRow
                  label="Country of Origin"
                  value={item.countryCodeOfOrigin}
                  isLight={isLight}
                />
              )}
              {item.provinceCodeOfOrigin && (
                <InfoRow
                  label="Province of Origin"
                  value={item.provinceCodeOfOrigin}
                  isLight={isLight}
                />
              )}
              {item.harmonizedSystemCode && (
                <InfoRow label="HS Code" value={item.harmonizedSystemCode} isLight={isLight} mono />
              )}
              {hsEdges.length > 0 && (
                <div>
                  <p className="text-stone-500 text-sm mb-1">Country-Specific HS Codes</p>
                  <div className="space-y-0.5">
                    {hsEdges.map((edge, i) => (
                      <p key={i} className="text-xs font-mono text-stone-500">
                        {edge.node.countryCode}: {edge.node.harmonizedSystemCode}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-500 italic">No customs data</p>
          )}
        </div>
      </div>

      {/* Inventory Levels */}
      {inventoryLevels.length > 0 && (
        <div>
          <SectionLabel
            icon={MapPin}
            label="Inventory by Location"
            count={inventoryLevels.length}
            isLight={isLight}
          />
          <div className="space-y-3">
            {inventoryLevels.map((level) => {
              const quantities = level.quantities ?? []
              const quantityMap = new Map(quantities.map((q) => [q.name, q]))

              return (
                <div key={level.id} className={cardStyle}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-stone-500" />
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {level.location.name}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                        level.location.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-stone-100 text-stone-600 dark:bg-stone-800/30 dark:text-stone-400'
                      )}
                    >
                      {level.location.isActive ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 @md:grid-cols-4 gap-3">
                    {Object.entries(QUANTITY_CONFIG).map(([key, config]) => {
                      const q = quantityMap.get(key)
                      const qty = q?.quantity ?? 0

                      if (!config.alwaysShow && qty === 0) return null

                      return (
                        <div key={key} className="space-y-0.5">
                          <p className="text-[11px] uppercase tracking-wider text-stone-500">
                            {config.label}
                          </p>
                          <p
                            className={cn(
                              'text-lg font-mono font-semibold tabular-nums',
                              config.colorFn(qty, isLight)
                            )}
                          >
                            {qty}
                          </p>
                          {q?.updatedAt && (
                            <p className="text-[10px] text-stone-400 font-mono">
                              {fmtDate(q.updatedAt)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
