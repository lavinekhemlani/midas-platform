'use client'

import { useShopifyProductDetail } from '../hooks/useShopifyData'
import type { ShopifyProductDetail } from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Package,
  DollarSign,
  FolderOpen,
  Layers,
  Image as ImageIcon,
  Tag,
  Database,
  ExternalLink,
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

export function ProductDetailPanel({
  productId,
  isLight,
  onClose,
}: {
  productId: number
  isLight: boolean
  onClose: () => void
}) {
  const { data: product, isLoading, error } = useShopifyProductDetail(String(productId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading product details...</span>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load product details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const collections = product.collections?.edges?.map((e) => e.node) ?? []
  const variants = product.variants?.edges?.map((e) => e.node) ?? []
  const mediaItems = product.media?.edges?.map((e) => e.node) ?? []
  const metafields = product.metafields?.edges?.map((e) => e.node) ?? []
  const cur = product.priceRangeV2?.minVariantPrice?.currencyCode || 'USD'

  const cardStyle = cn(
    'rounded-lg border p-4 space-y-3',
    isLight
      ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
      : 'bg-white/[0.02] border-[var(--theme-card-border)]'
  )

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  }

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
            <div className="flex items-center gap-2.5">
              <h2
                className={cn(
                  'text-lg font-semibold tracking-tight',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {product.title}
              </h2>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                  statusColors[product.status?.toUpperCase()] ||
                    'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                )}
              >
                {product.status}
              </span>
            </div>
            {product.vendor && (
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
                {product.vendor}
              </p>
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
        {/* Product Info */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Product Info
          </h3>
          <div className="space-y-2 text-sm">
            {product.productType && (
              <div className="flex justify-between">
                <span className="text-stone-500">Type</span>
                <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                  {product.productType}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Vendor</span>
              <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                {product.vendor || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Handle</span>
              <span className="text-stone-500 font-mono text-xs">{product.handle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-500 text-xs">{fmtDate(product.createdAt)}</span>
            </div>
            {product.seo?.title && (
              <div className="flex justify-between">
                <span className="text-stone-500">SEO Title</span>
                <span
                  className={cn(
                    'text-xs truncate max-w-[180px] text-right',
                    isLight ? 'text-stone-700' : 'text-stone-300'
                  )}
                >
                  {product.seo.title}
                </span>
              </div>
            )}
            {product.seo?.description && (
              <div>
                <span className="text-stone-500 text-xs">SEO Description</span>
                <p
                  className={cn(
                    'text-xs mt-0.5 line-clamp-2',
                    isLight ? 'text-stone-600' : 'text-stone-400'
                  )}
                >
                  {product.seo.description}
                </p>
              </div>
            )}
            {product.onlineStoreUrl && (
              <div className="flex justify-between items-center">
                <span className="text-stone-500">Online Store</span>
                <a
                  href={product.onlineStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs',
                    isLight
                      ? 'text-blue-600 hover:text-blue-700'
                      : 'text-blue-400 hover:text-blue-300'
                  )}
                >
                  View
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Price & Inventory */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Price & Inventory
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Price Range</span>
              <span
                className={cn(
                  'font-mono tabular-nums font-medium',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {fmt(product.priceRangeV2.minVariantPrice.amount, cur)}
                {product.priceRangeV2.minVariantPrice.amount !==
                  product.priceRangeV2.maxVariantPrice.amount && (
                  <> &ndash; {fmt(product.priceRangeV2.maxVariantPrice.amount, cur)}</>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Total Inventory</span>
              <span
                className={cn(
                  'font-mono tabular-nums font-medium',
                  product.totalInventory <= 0
                    ? isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                    : isLight
                      ? 'text-stone-900'
                      : 'text-white'
                )}
              >
                {product.totalInventory}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Tracks Inventory</span>
              <span
                className={cn(
                  'font-medium',
                  product.tracksInventory
                    ? isLight
                      ? 'text-emerald-600'
                      : 'text-emerald-400'
                    : 'text-stone-500'
                )}
              >
                {product.tracksInventory ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Collections */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Collections
          </h3>
          {collections.length > 0 ? (
            <div className="space-y-1.5 text-sm">
              {collections.map((col) => (
                <div key={col.id} className="flex items-center gap-2">
                  <FolderOpen className="w-3 h-3 text-stone-400 flex-shrink-0" />
                  <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                    {col.title}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500 italic">Not in any collection</p>
          )}
        </div>
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div>
          <SectionLabel icon={Layers} label="Variants" count={variants.length} isLight={isLight} />
          <div
            className={cn(
              'overflow-x-auto rounded-lg border',
              isLight ? 'border-stone-200' : 'border-white/[0.08]'
            )}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b',
                    isLight ? 'border-stone-200 bg-stone-50' : 'border-white/[0.08] bg-white/[0.02]'
                  )}
                >
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Barcode
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Inventory
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, i) => {
                  const levels =
                    variant.inventoryItem?.inventoryLevels?.edges?.map((e) => e.node) ?? []
                  return (
                    <tr
                      key={variant.id}
                      className={cn(
                        i % 2 === 0 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                        isLight ? 'border-stone-100' : 'border-white/[0.04]',
                        i < variants.length - 1 ? 'border-b' : ''
                      )}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {variant.image?.url && (
                            <img
                              src={variant.image.url}
                              alt={variant.image.altText || variant.title}
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <span
                            className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}
                          >
                            {variant.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs text-stone-500">
                          {variant.sku || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs text-stone-500">
                          {variant.barcode || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className={cn(
                              'font-mono tabular-nums font-medium',
                              isLight ? 'text-stone-900' : 'text-white'
                            )}
                          >
                            {fmt(variant.price, cur)}
                          </span>
                          {variant.compareAtPrice &&
                            parseFloat(variant.compareAtPrice) > parseFloat(variant.price) && (
                              <span className="font-mono tabular-nums text-xs text-stone-400 line-through">
                                {fmt(variant.compareAtPrice, cur)}
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-mono tabular-nums text-xs text-stone-500">
                          {variant.inventoryItem?.unitCost
                            ? fmt(
                                variant.inventoryItem.unitCost.amount,
                                variant.inventoryItem.unitCost.currencyCode
                              )
                            : '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {levels.length > 0 ? (
                          <div className="space-y-1">
                            {levels.map((level) => (
                              <div key={level.location.id} className="text-xs">
                                <span
                                  className={cn(
                                    'font-medium',
                                    isLight ? 'text-stone-700' : 'text-stone-300'
                                  )}
                                >
                                  {level.location.name}
                                </span>
                                <div className="flex gap-2 mt-0.5 text-stone-500">
                                  {level.quantities.map((q) => (
                                    <span key={q.name} className="font-mono">
                                      <span className="capitalize">{q.name}</span>:{' '}
                                      <span
                                        className={cn(
                                          q.name === 'available' && q.quantity <= 0
                                            ? isLight
                                              ? 'text-red-600'
                                              : 'text-red-400'
                                            : ''
                                        )}
                                      >
                                        {q.quantity}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'font-mono tabular-nums text-xs',
                              variant.inventoryQuantity <= 0
                                ? isLight
                                  ? 'text-red-600'
                                  : 'text-red-400'
                                : isLight
                                  ? 'text-stone-900'
                                  : 'text-white'
                            )}
                          >
                            {variant.inventoryQuantity}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media */}
      {mediaItems.length > 1 && (
        <div>
          <SectionLabel
            icon={ImageIcon}
            label="Media"
            count={mediaItems.length}
            isLight={isLight}
          />
          <div className="grid grid-cols-4 @lg:grid-cols-6 @xl:grid-cols-8 gap-2">
            {mediaItems.map((media, i) => (
              <div
                key={i}
                className={cn(
                  'aspect-square rounded-lg overflow-hidden border',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                {media.preview?.image?.url ? (
                  <img
                    src={media.preview.image.url}
                    alt={media.preview.image.altText || `Media ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      'w-full h-full flex items-center justify-center',
                      isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
                    )}
                  >
                    <ImageIcon className="w-4 h-4 text-stone-400" />
                  </div>
                )}
              </div>
            ))}
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
            className={cn(
              'overflow-x-auto rounded-lg border',
              isLight ? 'border-stone-200' : 'border-white/[0.08]'
            )}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b',
                    isLight ? 'border-stone-200 bg-stone-50' : 'border-white/[0.08] bg-white/[0.02]'
                  )}
                >
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Namespace
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {metafields.map((mf, i) => (
                  <tr
                    key={`${mf.namespace}-${mf.key}`}
                    className={cn(
                      i % 2 === 0 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                      isLight ? 'border-stone-100' : 'border-white/[0.04]',
                      i < metafields.length - 1 ? 'border-b' : ''
                    )}
                  >
                    <td className="py-2 px-3 font-mono text-xs text-stone-500">{mf.namespace}</td>
                    <td
                      className={cn(
                        'py-2 px-3 font-mono text-xs font-medium',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {mf.key}
                    </td>
                    <td className="py-2 px-3 text-xs text-stone-500 max-w-[300px] truncate">
                      {mf.value}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-mono',
                          isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/[0.08] text-stone-400'
                        )}
                      >
                        {mf.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <div className={cn(cardStyle)}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Tags
            </p>
            <div className="flex flex-wrap gap-1">
              {product.tags.map((tag: string) => (
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
        </div>
      )}
    </div>
  )
}
