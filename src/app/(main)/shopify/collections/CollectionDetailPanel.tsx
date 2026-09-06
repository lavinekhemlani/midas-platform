'use client'

import { useShopifyCollectionDetail } from '../hooks/useShopifyData'
import type {
  ShopifyCollectionDetailProduct,
  ShopifyCollectionDetailRule,
} from '@/lib/providers/shopify/types'
import { cn } from '@/lib/utils'
import { Loader2, X, Package, Sparkles, FolderOpen, Tag, Image as ImageIcon } from 'lucide-react'

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtPrice(amount: string, currencyCode = 'USD') {
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(num)
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').trim()
}

function truncate(str: string, maxLen: number) {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen).trimEnd() + '...'
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

export function CollectionDetailPanel({
  collectionId,
  isLight,
  onClose,
}: {
  collectionId: number
  isLight: boolean
  onClose: () => void
}) {
  const { data: collection, isLoading, error } = useShopifyCollectionDetail(String(collectionId))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
        <span className="ml-2 text-sm text-stone-500">Loading collection details...</span>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-stone-500">
          {error ? 'Failed to load collection details.' : 'No detail data available.'}
        </p>
      </div>
    )
  }

  const products = collection.products?.edges?.map((e) => e.node) ?? []
  const metafields = collection.metafields?.edges?.map((e) => e.node) ?? []
  const rules = collection.ruleSet?.rules ?? []
  const isPublished = !!collection.publishedAt
  const description = collection.descriptionHtml ? stripHtml(collection.descriptionHtml) : null

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
          <div className="flex items-start gap-3">
            {collection.image && (
              <img
                src={collection.image.url}
                alt={collection.image.altText ?? collection.title}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-stone-200/20"
              />
            )}
            <div>
              <h2
                className={cn(
                  'text-lg font-semibold tracking-tight',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {collection.title}
              </h2>
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-0.5">
                /{collection.handle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                isPublished
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800/30 dark:text-stone-400'
              )}
            >
              {isPublished ? 'Published' : 'Unpublished'}
            </span>
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
        {/* Card 1: Collection Info */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Collection Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Sort Order</span>
              <span
                className={cn('font-medium text-xs', isLight ? 'text-stone-900' : 'text-white')}
              >
                {collection.sortOrder.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Updated</span>
              <span
                className={cn('font-medium text-xs', isLight ? 'text-stone-900' : 'text-white')}
              >
                {fmtDate(collection.updatedAt)}
              </span>
            </div>
            {collection.templateSuffix && (
              <div className="flex justify-between">
                <span className="text-stone-500">Template</span>
                <span
                  className={cn('font-mono text-xs', isLight ? 'text-stone-900' : 'text-white')}
                >
                  {collection.templateSuffix}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Products</span>
              <span
                className={cn(
                  'font-mono text-xs font-medium',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {collection.productsCount?.count ?? 0}
              </span>
            </div>
            {description && (
              <div className="pt-1">
                <p className="text-xs text-stone-500 leading-relaxed">
                  {truncate(description, 200)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: SEO */}
        <div className={cardStyle}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">SEO</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-stone-500 text-xs block mb-0.5">SEO Title</span>
              <p
                className={cn(
                  'text-sm',
                  collection.seo?.title
                    ? isLight
                      ? 'text-stone-900'
                      : 'text-white'
                    : 'text-stone-400 italic'
                )}
              >
                {collection.seo?.title || 'Not set'}
              </p>
            </div>
            <div>
              <span className="text-stone-500 text-xs block mb-0.5">SEO Description</span>
              <p
                className={cn(
                  'text-xs leading-relaxed',
                  collection.seo?.description
                    ? isLight
                      ? 'text-stone-700'
                      : 'text-stone-300'
                    : 'text-stone-400 italic'
                )}
              >
                {collection.seo?.description
                  ? truncate(collection.seo.description, 150)
                  : 'Not set'}
              </p>
            </div>
            <div>
              <span className="text-stone-500 text-xs block mb-0.5">URL Handle</span>
              <p className={cn('font-mono text-xs', isLight ? 'text-stone-900' : 'text-white')}>
                /collections/{collection.handle}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Smart Collection Rules / Manual Collection */}
        <div className={cardStyle}>
          {collection.ruleSet && rules.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Collection Rules
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  <Sparkles className="w-2.5 h-2.5" />
                  Smart
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Products must match{' '}
                <span
                  className={cn('font-semibold', isLight ? 'text-stone-700' : 'text-stone-300')}
                >
                  {collection.ruleSet.appliedDisjunctively ? 'ANY' : 'ALL'}
                </span>{' '}
                of the following rules:
              </p>
              <div className="space-y-1.5">
                {rules.map((rule: ShopifyCollectionDetailRule, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-1.5 text-xs py-1 px-2 rounded',
                      isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
                    )}
                  >
                    <span className={cn('font-medium', isLight ? 'text-stone-900' : 'text-white')}>
                      {rule.column.replace(/_/g, ' ')}
                    </span>
                    <span className="text-stone-400 uppercase text-[10px] font-semibold tracking-wider">
                      {rule.relation.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={cn('font-medium', isLight ? 'text-purple-700' : 'text-purple-400')}
                    >
                      {rule.condition}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  Collection Type
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  <FolderOpen className="w-2.5 h-2.5" />
                  Manual
                </span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Products are manually added and removed from this collection. The order of products
                can be set manually or sorted automatically.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Products Section */}
      {products.length > 0 && (
        <div>
          <SectionLabel
            icon={Package}
            label={`Products in Collection`}
            count={products.length}
            isLight={isLight}
          />
          <div className="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4 gap-3">
            {products.map((product: ShopifyCollectionDetailProduct) => {
              const minPrice = product.priceRangeV2?.minVariantPrice
              const maxPrice = product.priceRangeV2?.maxVariantPrice
              const minAmt = minPrice ? parseFloat(minPrice.amount) : 0
              const maxAmt = maxPrice ? parseFloat(maxPrice.amount) : 0
              const currency = minPrice?.currencyCode ?? 'USD'
              const priceDisplay =
                minAmt === maxAmt
                  ? fmtPrice(String(minAmt), currency)
                  : `${fmtPrice(String(minAmt), currency)} - ${fmtPrice(String(maxAmt), currency)}`

              return (
                <div
                  key={product.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    isLight
                      ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] hover:bg-stone-50'
                      : 'bg-white/[0.02] border-[var(--theme-card-border)] hover:bg-white/[0.04]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {product.featuredImage ? (
                      <img
                        src={product.featuredImage.url}
                        alt={product.featuredImage.altText ?? product.title}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className={cn(
                          'w-10 h-10 rounded flex items-center justify-center flex-shrink-0',
                          isLight ? 'bg-stone-100' : 'bg-white/[0.06]'
                        )}
                      >
                        <ImageIcon className="w-4 h-4 text-stone-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate leading-tight',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {product.title}
                      </p>
                      {product.vendor && (
                        <p className="text-[11px] text-stone-500 truncate">{product.vendor}</p>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex items-center justify-between mt-2 pt-2 border-t',
                      isLight ? 'border-stone-200' : 'border-white/[0.08]'
                    )}
                  >
                    <span
                      className={cn(
                        'font-mono text-xs font-medium tabular-nums',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {priceDisplay}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-mono tabular-nums',
                        product.totalInventory === 0
                          ? isLight
                            ? 'text-red-600 font-semibold'
                            : 'text-red-400 font-semibold'
                          : 'text-stone-500'
                      )}
                    >
                      {product.totalInventory} in stock
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                        product.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : product.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-stone-100 text-stone-600 dark:bg-stone-800/30 dark:text-stone-400'
                      )}
                    >
                      {product.status.toLowerCase()}
                    </span>
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
          <SectionLabel icon={Tag} label="Metafields" count={metafields.length} isLight={isLight} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={cn(
                    'text-[11px] uppercase tracking-wider',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  <th className="text-left py-1.5 pr-4 font-medium">Namespace</th>
                  <th className="text-left py-1.5 pr-4 font-medium">Key</th>
                  <th className="text-left py-1.5 pr-4 font-medium">Value</th>
                  <th className="text-left py-1.5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {metafields.map((mf, i) => (
                  <tr
                    key={i}
                    className={cn('border-t', isLight ? 'border-stone-200' : 'border-white/[0.06]')}
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
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {mf.key}
                    </td>
                    <td className="py-1.5 pr-4 text-xs text-stone-500 max-w-[200px] truncate">
                      {mf.value}
                    </td>
                    <td className="py-1.5 text-xs text-stone-400 font-mono">{mf.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
