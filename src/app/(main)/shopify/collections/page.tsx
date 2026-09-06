'use client'

import { useState, useMemo, Fragment, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyCollections } from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ShopifyCollection } from '@/lib/providers/shopify/types'
import { CollectionDetailPanel } from './CollectionDetailPanel'
import {
  FolderOpen,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

function CollectionTypeBadge({ type }: { type: 'smart' | 'custom' }) {
  if (type === 'smart') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
        <Sparkles className="w-3 h-3" />
        Smart
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      <FolderOpen className="w-3 h-3" />
      Manual
    </span>
  )
}

export default function ShopifyCollectionsPage() {
  const { connected, isLoading: connLoading } = useShopifyConnection()
  const { data, isLoading, error, mutate } = useShopifyCollections(connected)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'smart' | 'custom'>('all')
  const [sortKey, setSortKey] = useState('products_count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedCollection, setExpandedCollection] = useState<number | null>(null)

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }
  const handleSort = (col: string) => {
    if (sortKey === col) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col)
      setSortDir(
        col === 'title' || col === 'name' || col === 'reason' || col === 'customer' ? 'asc' : 'desc'
      )
    }
  }

  const collections = data?.collections ?? []
  const summary = data?.summary

  const filtered = useMemo(() => {
    let items = collections.filter((c: ShopifyCollection) => {
      const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase())
      const matchesType = !typeFilter || typeFilter === 'all' || c.collection_type === typeFilter
      return matchesSearch && matchesType
    })
    items.sort((a: ShopifyCollection, b: ShopifyCollection) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'title':
          aVal = a.title || ''
          bVal = b.title || ''
          break
        case 'collection_type':
          aVal = a.collection_type || ''
          bVal = b.collection_type || ''
          break
        case 'products_count':
          aVal = a.products_count ?? 0
          bVal = b.products_count ?? 0
          break
        case 'published':
          aVal = a.published_at ? 1 : 0
          bVal = b.published_at ? 1 : 0
          break
        default:
          aVal = a.title || ''
          bVal = b.title || ''
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [collections, search, typeFilter, sortKey, sortDir])

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">
          No Shopify connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      <div
        className={cn(
          'mb-10 pt-2 pb-4 border-b shadow-sm',
          isLight
            ? 'border-stone-200/80 shadow-stone-200/50'
            : 'border-white/[0.06] shadow-black/20'
        )}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">
              Collections
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
            </p>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load collections. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div
            className={cn(
              'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
              isLight ? 'border-stone-200' : 'border-white/[0.08]'
            )}
          >
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                Total Collections
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {summary?.totalCollections ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                Smart Collections
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-purple-600' : 'text-purple-400'
                )}
              >
                {summary?.smartCollections ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                Manual Collections
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-blue-600' : 'text-blue-400'
                )}
              >
                {summary?.customCollections ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
                Published
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-emerald-600' : 'text-emerald-400'
                )}
              >
                {summary?.publishedCount ?? 0}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search collections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                  'border bg-transparent',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]',
                  isLight ? 'text-stone-900' : 'text-white',
                  'placeholder:text-stone-400',
                  'focus:border-amber-500/40'
                )}
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(val) => setTypeFilter(val as 'all' | 'smart' | 'custom')}
            >
              <SelectTrigger
                className={cn(
                  'w-[160px] h-9 text-sm border',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className="glass-luxury-card">
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="smart">Smart</SelectItem>
                <SelectItem value="custom">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Collections table */}
          <div
            className="overflow-x-auto overflow-y-auto max-h-[900px] rounded-lg border"
            style={{ borderColor: isLight ? 'rgb(214 211 209 / 0.8)' : 'rgba(255,255,255,0.08)' }}
          >
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                <tr
                  className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                >
                  <th className="text-left px-4 py-3 font-medium text-stone-500">
                    <button
                      onClick={() => handleSort('title')}
                      className="flex items-center gap-1 cursor-pointer select-none"
                    >
                      Collection <SortIcon col="title" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500">
                    <button
                      onClick={() => handleSort('collection_type')}
                      className="flex items-center gap-1 cursor-pointer select-none"
                    >
                      Type <SortIcon col="collection_type" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-stone-500">
                    <button
                      onClick={() => handleSort('products_count')}
                      className="flex items-center justify-end gap-1 cursor-pointer select-none ml-auto"
                    >
                      Products <SortIcon col="products_count" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500">
                    <button
                      onClick={() => handleSort('published')}
                      className="flex items-center gap-1 cursor-pointer select-none"
                    >
                      Status <SortIcon col="published" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((collection: ShopifyCollection, i: number) => (
                  <Fragment key={collection.id}>
                    <tr
                      onClick={() =>
                        setExpandedCollection(
                          expandedCollection === collection.id ? null : collection.id
                        )
                      }
                      className={cn(
                        'transition-colors cursor-pointer',
                        i % 2 === 0 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                        isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]',
                        expandedCollection === collection.id &&
                          (isLight ? 'bg-stone-100' : 'bg-white/[0.04]')
                      )}
                    >
                      <td
                        className={cn(
                          'px-4 py-3 font-medium',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {collection.title}
                      </td>
                      <td className="px-4 py-3">
                        <CollectionTypeBadge type={collection.collection_type} />
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {collection.products_count ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {collection.published_at ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                            Unpublished
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500 max-w-[300px] truncate">
                        {collection.body_html ? collection.body_html.replace(/<[^>]+>/g, '') : '-'}
                      </td>
                    </tr>
                    {expandedCollection === collection.id && (
                      <tr key={`${collection.id}-details`}>
                        <td colSpan={5} className="p-0 border-none">
                          <CollectionDetailPanel
                            collectionId={collection.id}
                            isLight={isLight}
                            onClose={() => setExpandedCollection(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                      No collections found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
