'use client'

import React, { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'
import { fmt } from '../_shared/components'

export default function BCOAuthInventoryPage() {
  const { connectionId, startDate, endDate } = useBCOAuthDev()

  return (
    <InventoryDiagnosticSection
      connectionId={connectionId}
      startDate={startDate}
      endDate={endDate}
    />
  )
}

function InventoryDiagnosticSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const fetchData = useCallback(async () => {
    if (!connectionId) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ connectionId })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const t0 = Date.now()
    try {
      const res = await fetch(`/api/providers/dynamics/inventory-test?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setData(json.data)
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, startDate, endDate])

  const entityProbe = data?.entityProbe
  const itemMetrics = data?.itemMetrics
  const movementAnalysis = data?.movementAnalysis
  const itemCategories = data?.itemCategories
  const locations = data?.locations
  const turnoverAnalysis = data?.turnoverAnalysis

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={fetchData}
          disabled={!connectionId || loading}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Probing Inventory Entities...'
            : data
              ? 'Re-run Inventory Diagnostic'
              : 'Run Inventory Diagnostic'}
        </button>
        {durationMs != null && (
          <span className="text-xs theme-text-secondary">{durationMs}ms total</span>
        )}
        {data && (
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
          >
            Copy JSON
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
            <p className="text-sm theme-text-secondary">
              Probing BC API entities for inventory data...
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Entity Availability */}
          <div className="glass-luxury-card p-5 space-y-4">
            <button
              onClick={() => toggleSection('entity-probe')}
              className="flex items-center gap-2 w-full text-left"
            >
              {expandedSections['entity-probe'] ? (
                <ChevronDown className="w-4 h-4 theme-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 theme-text-secondary" />
              )}
              <h3 className="text-base font-semibold theme-text-primary">
                Entity Availability Probe
              </h3>
              <span className="text-xs theme-text-secondary ml-2">
                {entityProbe?.available?.length || 0} available,{' '}
                {entityProbe?.unavailable?.length || 0} unavailable
              </span>
            </button>

            {expandedSections['entity-probe'] && entityProbe?.details && (
              <div className="grid gap-2 mt-3">
                {Object.entries(entityProbe.details).map(([name, info]: [string, any]) => (
                  <div
                    key={name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      info.available
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          info.available ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="font-mono text-sm theme-text-primary">{name}</span>
                        <p className="text-xs theme-text-secondary">{info.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      {info.available ? (
                        <>
                          <span className="theme-text-secondary">{info.durationMs}ms</span>
                          <span className="text-emerald-400">
                            {info.fields?.length || 0} fields
                          </span>
                        </>
                      ) : (
                        <span className="text-red-400 max-w-[200px] truncate">{info.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field Discovery */}
          {entityProbe?.details && (
            <div className="glass-luxury-card p-5 space-y-4">
              <button
                onClick={() => toggleSection('field-discovery')}
                className="flex items-center gap-2 w-full text-left"
              >
                {expandedSections['field-discovery'] ? (
                  <ChevronDown className="w-4 h-4 theme-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 theme-text-secondary" />
                )}
                <h3 className="text-base font-semibold theme-text-primary">Field Discovery</h3>
                <span className="text-xs theme-text-secondary ml-2">
                  Available fields per entity + sample record
                </span>
              </button>

              {expandedSections['field-discovery'] && (
                <div className="space-y-4 mt-3">
                  {Object.entries(entityProbe.details)
                    .filter(([, info]: [string, any]) => info.available && info.fields?.length > 0)
                    .map(([name, info]: [string, any]) => (
                      <div key={name} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <button
                          onClick={() => toggleSection(`fields-${name}`)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          {expandedSections[`fields-${name}`] ? (
                            <ChevronDown className="w-3.5 h-3.5 theme-text-secondary" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 theme-text-secondary" />
                          )}
                          <span className="font-mono text-sm font-medium theme-text-primary">
                            {name}
                          </span>
                          <span className="text-xs theme-text-secondary">
                            ({info.fields.length} fields)
                          </span>
                        </button>

                        {expandedSections[`fields-${name}`] && (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                              {info.fields.map((field: string) => (
                                <span
                                  key={field}
                                  className="px-2 py-0.5 text-xs font-mono rounded bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                            {info.sampleRecord && (
                              <div>
                                <p className="text-xs theme-text-secondary mb-1 font-medium">
                                  Sample Record:
                                </p>
                                <pre className="p-3 rounded bg-black/30 text-xs font-mono theme-text-primary overflow-x-auto max-h-[300px] overflow-y-auto">
                                  {JSON.stringify(info.sampleRecord, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Item Metrics */}
          {itemMetrics && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">Item Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Items', value: itemMetrics.totalItems },
                  { label: 'With Stock', value: itemMetrics.withStock },
                  { label: 'Out of Stock', value: itemMetrics.outOfStock },
                  { label: 'Blocked', value: itemMetrics.blocked },
                  { label: 'Total Units', value: itemMetrics.totalUnits.toLocaleString() },
                  { label: 'Est. Value', value: fmt(itemMetrics.estimatedValue) },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      {card.label}
                    </p>
                    <p className="text-sm font-semibold theme-text-primary mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {Object.keys(itemMetrics.byType).length > 0 && (
                <div>
                  <p className="text-xs font-medium theme-text-secondary mb-2">By Type</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(itemMetrics.byType).map(([type, count]: [string, any]) => (
                      <span
                        key={type}
                        className="px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 theme-text-primary"
                      >
                        {type}: <span className="font-semibold">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {itemMetrics.byCategory?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('by-category')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['by-category'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    By Category ({itemMetrics.byCategory.length} categories)
                  </button>
                  {expandedSections['by-category'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 theme-text-secondary">Category</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Items</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Units</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemMetrics.byCategory.map((cat: any) => (
                            <tr
                              key={cat.category}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="py-1.5 px-3 theme-text-primary">{cat.category}</td>
                              <td className="py-1.5 px-3 text-right font-mono theme-text-secondary">
                                {cat.count}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono theme-text-secondary">
                                {cat.totalUnits.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono theme-text-primary">
                                {fmt(cat.totalValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {itemMetrics.topByValue?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('top-by-value')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['top-by-value'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Top Items by Value ({itemMetrics.topByValue.length})
                  </button>
                  {expandedSections['top-by-value'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 theme-text-secondary">Item</th>
                            <th className="text-left py-2 px-3 theme-text-secondary">Number</th>
                            <th className="text-left py-2 px-3 theme-text-secondary">Category</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Qty</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Unit Cost</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">
                              Total Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemMetrics.topByValue.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-1.5 px-3 theme-text-primary truncate max-w-[200px]">
                                {item.name}
                              </td>
                              <td className="py-1.5 px-3 font-mono theme-text-secondary">
                                {item.number}
                              </td>
                              <td className="py-1.5 px-3 theme-text-secondary">{item.category}</td>
                              <td className="py-1.5 px-3 text-right font-mono theme-text-secondary">
                                {item.inventory}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono theme-text-secondary">
                                {fmt(item.unitCost)}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-semibold theme-text-primary">
                                {fmt(item.totalValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Movement Analysis */}
          {movementAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">
                Item Ledger Entries (Movements)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Entries', value: movementAnalysis.totalEntries.toLocaleString() },
                  { label: 'Entry Types', value: Object.keys(movementAnalysis.entryTypes).length },
                  { label: 'Months Covered', value: movementAnalysis.byMonth.length },
                  { label: 'Fields Available', value: movementAnalysis.fields.length },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      {card.label}
                    </p>
                    <p className="text-sm font-semibold theme-text-primary mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {Object.keys(movementAnalysis.entryTypes).length > 0 && (
                <div>
                  <p className="text-xs font-medium theme-text-secondary mb-2">Entry Types</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(movementAnalysis.entryTypes).map(
                      ([type, count]: [string, any]) => (
                        <span
                          key={type}
                          className="px-2.5 py-1 text-xs rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300"
                        >
                          {type}: <span className="font-semibold">{count}</span>
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {movementAnalysis.byMonth.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('monthly-movements')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['monthly-movements'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Monthly Movements ({movementAnalysis.byMonth.length} months)
                  </button>
                  {expandedSections['monthly-movements'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 theme-text-secondary">Month</th>
                            <th className="text-right py-2 px-3 text-emerald-400">Inbound</th>
                            <th className="text-right py-2 px-3 text-red-400">Outbound</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movementAnalysis.byMonth.map((m: any) => (
                            <tr key={m.month} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-1.5 px-3 font-mono theme-text-primary">
                                {m.month}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-emerald-400">
                                +{m.inbound.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-red-400">
                                -{m.outbound.toLocaleString()}
                              </td>
                              <td
                                className={`py-1.5 px-3 text-right font-mono font-semibold ${m.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                              >
                                {m.net >= 0 ? '+' : ''}
                                {m.net.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {movementAnalysis.topMovedItems?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('top-moved')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['top-moved'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Top Moved Items ({movementAnalysis.topMovedItems.length})
                  </button>
                  {expandedSections['top-moved'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 theme-text-secondary">Item</th>
                            <th className="text-left py-2 px-3 theme-text-secondary">Number</th>
                            <th className="text-right py-2 px-3 text-emerald-400">Total In</th>
                            <th className="text-right py-2 px-3 text-red-400">Total Out</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movementAnalysis.topMovedItems.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-1.5 px-3 theme-text-primary truncate max-w-[200px]">
                                {item.itemName}
                              </td>
                              <td className="py-1.5 px-3 font-mono theme-text-secondary">
                                {item.itemNumber}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-emerald-400">
                                +{item.totalIn.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-red-400">
                                -{item.totalOut.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categories & Locations */}
          {(itemCategories || locations) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {itemCategories && (
                <div className="glass-luxury-card p-5 space-y-3">
                  <h3 className="text-base font-semibold theme-text-primary">
                    Item Categories ({itemCategories.length})
                  </h3>
                  {itemCategories.length > 0 ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {itemCategories.map((cat: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 px-3 rounded bg-white/5 text-xs"
                        >
                          <span className="theme-text-primary">
                            {cat.code || cat.displayName || cat.id}
                          </span>
                          <span className="theme-text-secondary">
                            {cat.description || cat.displayName || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm theme-text-secondary">No item categories found</p>
                  )}
                </div>
              )}

              {locations && (
                <div className="glass-luxury-card p-5 space-y-3">
                  <h3 className="text-base font-semibold theme-text-primary">
                    Locations ({locations.length})
                  </h3>
                  {locations.length > 0 ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {locations.map((loc: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 px-3 rounded bg-white/5 text-xs"
                        >
                          <span className="theme-text-primary font-mono">{loc.code || loc.id}</span>
                          <span className="theme-text-secondary">
                            {loc.displayName || loc.name || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm theme-text-secondary">No locations found</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Turnover Analysis */}
          {turnoverAnalysis && (
            <div className="glass-luxury-card p-5 space-y-4">
              <h3 className="text-base font-semibold theme-text-primary">Turnover Analysis</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Period Days', value: turnoverAnalysis.periodDays },
                  {
                    label: 'Inventory Turnover',
                    value:
                      turnoverAnalysis.inventoryTurnover != null
                        ? `${turnoverAnalysis.inventoryTurnover}x`
                        : 'N/A',
                  },
                  {
                    label: 'Days Inv. Outstanding',
                    value:
                      turnoverAnalysis.daysInventoryOutstanding != null
                        ? `${turnoverAnalysis.daysInventoryOutstanding} days`
                        : 'N/A',
                  },
                  { label: 'Slow-Moving Items', value: turnoverAnalysis.slowMovingItemCount },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      {card.label}
                    </p>
                    <p className="text-sm font-semibold theme-text-primary mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {turnoverAnalysis.slowMovingItems?.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('slow-moving')}
                    className="flex items-center gap-2 text-xs font-medium theme-text-secondary mb-2"
                  >
                    {expandedSections['slow-moving'] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Slow-Moving Items ({turnoverAnalysis.slowMovingItems.length})
                  </button>
                  {expandedSections['slow-moving'] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-3 theme-text-secondary">Item</th>
                            <th className="text-left py-2 px-3 theme-text-secondary">Number</th>
                            <th className="text-right py-2 px-3 theme-text-secondary">
                              Qty On Hand
                            </th>
                            <th className="text-right py-2 px-3 theme-text-secondary">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {turnoverAnalysis.slowMovingItems.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-1.5 px-3 theme-text-primary truncate max-w-[200px]">
                                {item.name}
                              </td>
                              <td className="py-1.5 px-3 font-mono theme-text-secondary">
                                {item.number}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono theme-text-secondary">
                                {item.inventory}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-amber-400">
                                {fmt(item.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Raw JSON */}
          <div className="glass-luxury-card p-5 space-y-3">
            <button
              onClick={() => toggleSection('raw-json')}
              className="flex items-center gap-2 w-full text-left"
            >
              {expandedSections['raw-json'] ? (
                <ChevronDown className="w-4 h-4 theme-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 theme-text-secondary" />
              )}
              <h3 className="text-base font-semibold theme-text-primary">Raw JSON Response</h3>
            </button>
            {expandedSections['raw-json'] && (
              <pre className="p-4 rounded-lg bg-black/20 overflow-x-auto text-xs font-mono theme-text-primary max-h-[600px] overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )
}
