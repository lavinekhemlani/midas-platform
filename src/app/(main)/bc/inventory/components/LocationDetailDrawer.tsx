'use client'

import { useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { useBCLedgerEntries, type LedgerEntry } from '../../hooks/useBCLedgerEntries'
import { InfoTooltip } from './InfoTooltip'
import type { LocationRow } from '../../hooks/useBCInventoryEnhanced'
import { MapPin, Phone, Mail, Globe, User, X } from 'lucide-react'

interface LocationDetailDrawerProps {
  open: boolean
  onClose: () => void
  connectionId: string
  location: LocationRow | null
  currency?: string
}

interface ItemAtLocation {
  itemNumber: string
  description: string
  netQty: number
  totalCost: number
  purchaseQty: number
  purchaseCost: number
  saleQty: number
  saleCost: number
  entryCount: number
}

function buildItemsAtLocation(entries: LedgerEntry[], locationCode: string): ItemAtLocation[] {
  const filtered = entries.filter((e) => e.locationCode === locationCode)
  const map = new Map<string, ItemAtLocation>()

  for (const e of filtered) {
    const key = e.itemNumber
    let item = map.get(key)
    if (!item) {
      item = {
        itemNumber: e.itemNumber,
        description: e.description || e.itemNumber,
        netQty: 0,
        totalCost: 0,
        purchaseQty: 0,
        purchaseCost: 0,
        saleQty: 0,
        saleCost: 0,
        entryCount: 0,
      }
      map.set(key, item)
    }
    item.netQty += e.quantity ?? 0
    item.totalCost += Math.abs(e.costAmountActual ?? 0)
    item.entryCount++

    const type = (e.entryType || '').toLowerCase()
    if (type.includes('purchase') || type.includes('positive')) {
      item.purchaseQty += Math.abs(e.quantity ?? 0)
      item.purchaseCost += Math.abs(e.costAmountActual ?? 0)
    } else if (type.includes('sale') || type.includes('negative')) {
      item.saleQty += Math.abs(e.quantity ?? 0)
      item.saleCost += Math.abs(e.costAmountActual ?? 0)
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost)
}

export function LocationDetailDrawer({
  open,
  onClose,
  connectionId,
  location,
  currency = 'USD',
}: LocationDetailDrawerProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [open, location?.code])

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      cardBg: isLight ? 'bg-stone-200/40' : 'bg-white/[0.03]',
      rowBg: isLight ? 'bg-stone-50/50' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-100/80' : 'hover:bg-white/[0.06]',
      headerBg: isLight ? 'bg-stone-100' : 'bg-[#1a1a1a]',
    }),
    [isLight]
  )

  const { entries, isLoading } = useBCLedgerEntries(open ? connectionId : null)

  const locationCode = location?.code || ''

  const itemsAtLocation = useMemo(() => {
    if (!locationCode || entries.length === 0) return []
    return buildItemsAtLocation(entries, locationCode)
  }, [entries, locationCode])

  const locationLedgerStats = useMemo(() => {
    const filtered = entries.filter((e) => e.locationCode === locationCode)
    let netQty = 0
    let totalCost = 0
    let purchaseQty = 0
    let purchaseCost = 0
    let saleQty = 0
    let saleCost = 0

    for (const e of filtered) {
      netQty += e.quantity ?? 0
      totalCost += Math.abs(e.costAmountActual ?? 0)
      const type = (e.entryType || '').toLowerCase()
      if (type.includes('purchase') || type.includes('positive')) {
        purchaseQty += Math.abs(e.quantity ?? 0)
        purchaseCost += Math.abs(e.costAmountActual ?? 0)
      } else if (type.includes('sale') || type.includes('negative')) {
        saleQty += Math.abs(e.quantity ?? 0)
        saleCost += Math.abs(e.costAmountActual ?? 0)
      }
    }
    return {
      netQty,
      totalCost,
      purchaseQty,
      purchaseCost,
      saleQty,
      saleCost,
      entryCount: filtered.length,
      uniqueItems: new Set(filtered.map((e) => e.itemNumber)).size,
    }
  }, [entries, locationCode])

  const hasLedgerData = locationLedgerStats.entryCount > 0

  if (!open || !location) return null

  return (
    <div
      ref={cardRef}
      className={cn(
        'mt-6 rounded-xl border overflow-hidden scroll-mt-4',
        isLight
          ? 'border-stone-200 bg-white shadow-lg shadow-stone-200/50'
          : 'border-white/[0.08] bg-[#0f0f15] shadow-lg shadow-black/30'
      )}
      style={{ background: 'var(--theme-bg)' }}
    >
      {isLoading ? (
        <div className="p-6">
          <h3 className="theme-text-primary text-lg font-semibold">Loading location...</h3>
          <p className="theme-text-secondary text-sm mt-1">
            Fetching inventory data from Business Central
          </p>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {/* ── Header ── */}
          <div className={cn('p-6 pb-5 border-b', styles.border)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('text-[12px] font-mono mb-1', styles.textMuted)}>
                  {location.code}
                </p>
                <h3 className={cn('text-lg font-semibold', styles.text)}>{location.name}</h3>
                {(location.address || location.city) && (
                  <p className={cn('text-[13px] mt-1.5', styles.textMuted)}>
                    {[location.address, location.addressLine2].filter(Boolean).join(', ')}
                    {(location.address || location.addressLine2) &&
                      (location.city || location.state) &&
                      ' — '}
                    {[location.city, location.state, location.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                    {location.country && (
                      <span className="ml-1.5 opacity-60">{location.country}</span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-lg transition-colors shrink-0 mt-1',
                  isLight
                    ? 'hover:bg-stone-100 text-stone-400'
                    : 'hover:bg-white/[0.06] text-stone-500'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Contact Info ── */}
          {(location.contact || location.phoneNumber || location.email || location.website) && (
            <div className={cn('px-6 py-4 border-b', styles.border)}>
              <div className="flex flex-col gap-2.5">
                {location.contact && (
                  <div className="flex items-center gap-2.5">
                    <User className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                    <span className={cn('text-[13px]', styles.text)}>{location.contact}</span>
                  </div>
                )}
                {location.phoneNumber && (
                  <div className="flex items-center gap-2.5">
                    <Phone className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                    <span className={cn('text-[13px] font-mono', styles.text)}>
                      {location.phoneNumber}
                    </span>
                  </div>
                )}
                {location.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                    <span className={cn('text-[13px]', styles.text)}>{location.email}</span>
                  </div>
                )}
                {location.website && (
                  <div className="flex items-center gap-2.5">
                    <Globe className={cn('w-3.5 h-3.5 shrink-0', styles.textMuted)} />
                    <span className={cn('text-[13px]', styles.text)}>{location.website}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Inventory Metrics ── */}
          {hasLedgerData ? (
            <>
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn('p-3.5 rounded-lg', styles.cardBg)}>
                    <div
                      className={cn(
                        'text-[11px] uppercase tracking-wider font-medium mb-1.5',
                        styles.textMuted
                      )}
                    >
                      Net Quantity
                    </div>
                    <div
                      className={cn(
                        'text-[22px] font-mono font-semibold tabular-nums leading-tight',
                        styles.text
                      )}
                    >
                      {Math.round(locationLedgerStats.netQty).toLocaleString()}
                    </div>
                    <div className={cn('text-[11px] mt-1', styles.textMuted)}>
                      {locationLedgerStats.uniqueItems} unique items
                    </div>
                  </div>
                  <div className={cn('p-3.5 rounded-lg', styles.cardBg)}>
                    <div
                      className={cn(
                        'text-[11px] uppercase tracking-wider font-medium mb-1.5',
                        styles.textMuted
                      )}
                    >
                      Total Cost
                    </div>
                    <div
                      className={cn(
                        'text-[22px] font-mono font-semibold tabular-nums leading-tight',
                        styles.text
                      )}
                    >
                      {formatCompactCurrency(locationLedgerStats.totalCost, currency)}
                    </div>
                    <div className={cn('text-[11px] mt-1', styles.textMuted)}>
                      {locationLedgerStats.entryCount.toLocaleString()} ledger entries
                    </div>
                  </div>
                  <div
                    className={cn(
                      'p-3.5 rounded-lg',
                      isLight ? 'bg-green-50' : 'bg-green-500/[0.06]'
                    )}
                  >
                    <div
                      className={cn(
                        'text-[11px] uppercase tracking-wider font-medium mb-1.5',
                        styles.textMuted
                      )}
                    >
                      Purchases
                    </div>
                    <div className="text-[22px] font-mono font-semibold tabular-nums leading-tight text-green-500">
                      {formatCompactCurrency(locationLedgerStats.purchaseCost, currency)}
                    </div>
                    <div className={cn('text-[11px] mt-1', styles.textMuted)}>
                      {Math.round(locationLedgerStats.purchaseQty).toLocaleString()} units
                    </div>
                  </div>
                  <div
                    className={cn(
                      'p-3.5 rounded-lg',
                      isLight ? 'bg-blue-50' : 'bg-blue-500/[0.06]'
                    )}
                  >
                    <div
                      className={cn(
                        'text-[11px] uppercase tracking-wider font-medium mb-1.5',
                        styles.textMuted
                      )}
                    >
                      Sales
                    </div>
                    <div className="text-[22px] font-mono font-semibold tabular-nums leading-tight text-blue-500">
                      {formatCompactCurrency(locationLedgerStats.saleCost, currency)}
                    </div>
                    <div className={cn('text-[11px] mt-1', styles.textMuted)}>
                      {Math.round(locationLedgerStats.saleQty).toLocaleString()} units
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Items Table ── */}
              <div className={cn('px-6 pb-6 border-t', styles.border)}>
                <div className="flex items-center justify-between pt-5 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-[13px] font-semibold', styles.text)}>
                      Items at this Location
                    </span>
                    <InfoTooltip
                      description="All items with ledger entry activity at this location, sorted by total cost value descending."
                      calculationTooltip={{
                        formula:
                          'Items = ledger entries WHERE Location_Code = this location, grouped by itemNumber\nNet Qty = Σ quantity per item\nCost = Σ |costAmountActual| per item',
                        components: [
                          {
                            label: 'Unique Items',
                            value: itemsAtLocation.length,
                            highlight: true,
                          },
                          {
                            label: 'Total Entries',
                            value: locationLedgerStats.entryCount,
                          },
                        ],
                      }}
                      note={`Source: BC OData Web Service → ItemLedgerEntries filtered by Location_Code = '${locationCode}'.`}
                    />
                  </div>
                  <span className={cn('text-[11px] font-mono', styles.textMuted)}>
                    {itemsAtLocation.length} items
                  </span>
                </div>

                <div className={cn('border rounded-lg overflow-hidden', styles.border)}>
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10">
                        <tr className={styles.headerBg}>
                          <th
                            className={cn(
                              'text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider',
                              styles.textMuted
                            )}
                          >
                            Item
                          </th>
                          <th
                            className={cn(
                              'text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider',
                              styles.textMuted
                            )}
                          >
                            Net Qty
                          </th>
                          <th
                            className={cn(
                              'text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider',
                              styles.textMuted
                            )}
                          >
                            Cost
                          </th>
                          <th
                            className={cn(
                              'text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider',
                              styles.textMuted
                            )}
                          >
                            Purchases
                          </th>
                          <th
                            className={cn(
                              'text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider',
                              styles.textMuted
                            )}
                          >
                            Sales
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsAtLocation.map((item, idx) => (
                          <tr
                            key={item.itemNumber}
                            className={cn(
                              'border-t transition-colors',
                              styles.border,
                              idx % 2 === 1 && styles.rowBg
                            )}
                          >
                            <td className={cn('px-3 py-2', styles.text)}>
                              <div className="text-[10px] font-mono text-amber-500/80">
                                {item.itemNumber}
                              </div>
                              <div className="text-[12px] truncate max-w-[200px]">
                                {item.description}
                              </div>
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2 text-right text-[12px] font-mono tabular-nums',
                                styles.text
                              )}
                            >
                              {Math.round(item.netQty).toLocaleString()}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2 text-right text-[12px] font-mono tabular-nums font-semibold',
                                styles.text
                              )}
                            >
                              {formatCompactCurrency(item.totalCost, currency)}
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] font-mono tabular-nums text-green-500">
                              {item.purchaseCost > 0 ? (
                                formatCompactCurrency(item.purchaseCost, currency)
                              ) : (
                                <span className="opacity-30">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] font-mono tabular-nums text-blue-500">
                              {item.saleCost > 0 ? (
                                formatCompactCurrency(item.saleCost, currency)
                              ) : (
                                <span className="opacity-30">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={cn('px-6 py-12 text-center')}>
              <MapPin
                className={cn('w-10 h-10 mx-auto mb-3', styles.textMuted)}
                style={{ opacity: 0.15 }}
              />
              <p className={cn('text-sm font-medium', styles.textMuted)}>
                No inventory activity data available
              </p>
              <p
                className={cn(
                  'text-xs mt-1.5 max-w-[280px] mx-auto leading-relaxed',
                  styles.textMuted
                )}
              >
                Per-location inventory data requires an OData Web Service that exposes Location_Code
                on Item Ledger Entries.
              </p>
            </div>
          )}

          {/* Bottom spacer */}
          <div className="h-6" />
        </div>
      )}
    </div>
  )
}
