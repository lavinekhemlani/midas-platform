'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { ForecastLineItem, ForecastPeriod, ForecastHorizon } from '@/types/forecasting'
import { CASH_FLOW_CATEGORIES, PROFIT_LOSS_CATEGORIES } from '@/types/forecasting'
import { cn } from '@/lib/utils'

interface ForecastTableProps {
  lineItems: ForecastLineItem[]
  periods: ForecastPeriod[]
  horizon: ForecastHorizon
  currency: string
  isValidating?: boolean
}

function groupByCategory(items: ForecastLineItem[]) {
  const groups = new Map<string, ForecastLineItem[]>()
  for (const item of items) {
    const cat = item.category
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(item)
  }
  return groups
}

const stickyColStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 10,
  backgroundColor: 'rgb(var(--theme-card-bg-rgb))',
}

const stickyHeadStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  backgroundColor: 'rgb(var(--theme-card-bg-rgb))',
}

const stickyCornerStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  top: 0,
  zIndex: 30,
  backgroundColor: 'rgb(var(--theme-card-bg-rgb))',
}

export function ForecastTable({
  lineItems,
  periods,
  horizon,
  currency,
  isValidating,
}: ForecastTableProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dividerColRef = useRef<HTMLTableCellElement>(null)
  const hasAutoScrolled = useRef(false)

  const toggleSection = (category: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const allCategories = useMemo(() => {
    const cats = [...new Set(lineItems.map((i) => i.category))]
    const labels: Record<string, string> = {
      ...CASH_FLOW_CATEGORIES,
      ...PROFIT_LOSS_CATEGORIES,
    }
    return cats.map((cat) => ({
      key: cat,
      label: labels[cat] || cat,
    }))
  }, [lineItems])

  const grouped = useMemo(() => groupByCategory(lineItems), [lineItems])
  const periodKeys = useMemo(() => periods.map((_, i) => `period_${i}`), [periods])
  const firstForecastIndex = useMemo(() => periods.findIndex((p) => !p.isHistorical), [periods])

  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current
    const dividerCol = dividerColRef.current
    if (!container || !dividerCol) return

    const containerRect = container.getBoundingClientRect()
    const colRect = dividerCol.getBoundingClientRect()

    // The sticky left column (~180px) is always visible, so the scrollable
    // visible area is narrower. Center the divider border within that region.
    // The divider border is the left edge of the first forecast column.
    const stickyWidth = 180
    const scrollableWidth = containerRect.width - stickyWidth
    const dividerLeftAbsolute = colRect.left - containerRect.left + container.scrollLeft
    const targetScroll = dividerLeftAbsolute - stickyWidth - scrollableWidth / 2 + colRect.width / 2

    const startScroll = container.scrollLeft
    const distance = Math.max(0, targetScroll) - startScroll
    if (Math.abs(distance) < 5) return

    const duration = 1200
    const startTime = performance.now()

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      container.scrollLeft = startScroll + distance * easeInOutCubic(progress)
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    const card = cardRef.current
    if (!card || firstForecastIndex < 0) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAutoScrolled.current) {
          hasAutoScrolled.current = true
          requestAnimationFrame(() => scrollToToday())
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(card)
    return () => observer.disconnect()
  }, [scrollToToday, firstForecastIndex])

  const historicalCount = useMemo(() => periods.filter((p) => p.isHistorical).length, [periods])
  const forecastCount = useMemo(() => periods.filter((p) => !p.isHistorical).length, [periods])

  const sectionTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {}
    for (const [cat, items] of grouped.entries()) {
      const sectionTotal: Record<string, number> = {}
      for (const key of periodKeys) {
        sectionTotal[key] = items
          .filter((i) => !i.isSummary)
          .reduce((sum, item) => sum + (item.values[key] || 0), 0)
      }
      totals[cat] = sectionTotal
    }
    return totals
  }, [grouped, periodKeys])

  const grandTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const key of periodKeys) {
      totals[key] = Object.values(sectionTotals).reduce(
        (sum, section) => sum + (section[key] || 0),
        0
      )
    }
    return totals
  }, [sectionTotals, periodKeys])

  const beginningCash = useMemo(() => {
    if (periods.length === 0) return {}
    const result: Record<string, number> = {}
    for (let i = 0; i < periods.length; i++) {
      const key = `period_${i}`
      if (i === 0) {
        result[key] = periods[0].cumulativeCash - (grandTotals[key] || 0)
      } else {
        result[key] = periods[i - 1].cumulativeCash
      }
    }
    return result
  }, [periods, grandTotals])

  const formatVal = (value: number) => formatCompactCurrency(value, currency)

  const valueColorClass = (value: number) =>
    value > 0 ? 'text-theme-green' : value < 0 ? 'text-theme-red' : 'theme-text-secondary'

  const dividerClass = (i: number) =>
    i === firstForecastIndex ? 'border-l-2 border-l-amber-500/40' : ''

  let globalRowIndex = 0
  const stripeClass = () => {
    const idx = globalRowIndex++
    return idx % 2 === 1 ? 'bg-white/[0.02]' : ''
  }

  const renderLineItem = (item: ForecastLineItem, depth: number = 0) => {
    const paddingLeft = 24 + depth * 20
    const rowTotal = periodKeys.reduce((sum, key) => sum + (item.values[key] || 0), 0)
    const stripe = stripeClass()

    return (
      <tr
        key={item.id}
        className={cn(
          'transition-colors hover:bg-gray-100/40 dark:hover:bg-white/[0.04]',
          stripe,
          item.isSummary && 'font-semibold',
          item.isMemory && 'bg-purple-500/[0.03]'
        )}
      >
        <td className="py-2.5 pr-4" style={{ ...stickyColStyle, paddingLeft }}>
          <span
            className={cn(
              'text-sm',
              item.isSummary ? 'theme-text-primary font-semibold' : 'theme-text-secondary',
              item.isMemory && 'text-theme-purple'
            )}
          >
            {item.isMemory && '\u27E1 '}
            {item.name}
          </span>
        </td>
        {periods.map((period, i) => {
          const key = `period_${i}`
          const value = item.values[key] || 0
          return (
            <td
              key={key}
              className={cn(
                'py-2.5 px-3 text-right text-sm font-mono whitespace-nowrap',
                valueColorClass(value),
                !period.isHistorical && 'bg-amber-500/[0.02]',
                dividerClass(i)
              )}
            >
              {formatVal(value)}
            </td>
          )
        })}
        <td
          className={cn(
            'py-2.5 px-3 text-right text-sm font-mono font-semibold whitespace-nowrap',
            valueColorClass(rowTotal)
          )}
        >
          {formatVal(rowTotal)}
        </td>
      </tr>
    )
  }

  return (
    <Card
      ref={cardRef}
      className="glass-luxury-card border border-gray-200/10 overflow-hidden gap-0"
    >
      <CardHeader className="pb-0 pt-4 px-6">
        <CardTitle className="chart-title text-sm theme-text-secondary font-medium">
          {horizon === '13-week' ? 'Weekly' : 'Monthly'} Line Items
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative">
        {/* Loading overlay */}
        {isValidating && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(var(--theme-bg-rgb), 0.4)',
              backdropFilter: 'blur(1px)',
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg"
              style={{
                background: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-card-border)',
              }}
            >
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--theme-yellow)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--theme-yellow)' }}>
                Updating...
              </span>
            </div>
          </div>
        )}

        {/* Scrollable container — both axes */}
        <div
          ref={scrollContainerRef}
          className="overflow-auto styled-scrollbar"
          style={{ maxHeight: 520 }}
        >
          <table className="w-full min-w-[800px]">
            <thead>
              {/* Merged Actual / Forecast banner */}
              <tr style={stickyHeadStyle}>
                <th className="py-1.5 pr-4 min-w-[180px]" style={stickyCornerStyle} />
                {historicalCount > 0 && (
                  <th
                    colSpan={historicalCount}
                    className="py-1.5 px-2 text-center text-[10px] uppercase tracking-widest font-medium theme-text-secondary opacity-50"
                    style={stickyHeadStyle}
                  >
                    Actual
                  </th>
                )}
                {forecastCount > 0 && (
                  <th
                    colSpan={forecastCount}
                    className={cn(
                      'py-1.5 px-2 text-center text-[10px] uppercase tracking-widest font-medium opacity-50',
                      dividerClass(firstForecastIndex)
                    )}
                    style={{ ...stickyHeadStyle, color: 'var(--theme-yellow, #ff8100)' }}
                  >
                    Forecast
                  </th>
                )}
                <th className="py-1.5 px-2" style={stickyHeadStyle} />
              </tr>
              {/* Period labels */}
              <tr style={stickyHeadStyle} className="border-b border-gray-200/10">
                <th className="py-2.5 pr-4 min-w-[180px]" style={stickyCornerStyle} />
                {periods.map((period, i) => (
                  <th
                    key={`period_${i}`}
                    ref={i === firstForecastIndex ? dividerColRef : undefined}
                    className={cn(
                      'py-2.5 px-3 text-right text-xs uppercase tracking-wider whitespace-nowrap',
                      period.isHistorical ? 'theme-text-secondary' : '',
                      dividerClass(i)
                    )}
                    style={{
                      ...stickyHeadStyle,
                      ...(period.isHistorical
                        ? {}
                        : { color: 'var(--theme-yellow, #ff8100)', opacity: 0.7 }),
                    }}
                  >
                    {period.label}
                  </th>
                ))}
                <th
                  className="py-2.5 px-3 text-right text-xs uppercase tracking-wider theme-text-secondary whitespace-nowrap"
                  style={stickyHeadStyle}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Beginning Cash */}
              <tr className="bg-white/[0.02]">
                <td className="py-2.5 pr-4 pl-6" style={stickyColStyle}>
                  <span className="text-sm font-semibold theme-text-primary">Beginning Cash</span>
                </td>
                {periods.map((_, i) => {
                  const key = `period_${i}`
                  const val = beginningCash[key] || 0
                  return (
                    <td
                      key={key}
                      className={cn(
                        'py-2.5 px-3 text-right text-sm font-mono theme-text-primary whitespace-nowrap',
                        dividerClass(i)
                      )}
                    >
                      {formatVal(val)}
                    </td>
                  )
                })}
                <td className="py-2.5 px-3 text-right text-sm font-mono theme-text-secondary whitespace-nowrap">
                  &mdash;
                </td>
              </tr>

              {/* Sections */}
              {allCategories.map(({ key: cat, label }) => {
                const items = grouped.get(cat) || []
                const nonSummaryItems = items.filter((i) => !i.isSummary)
                const isCollapsed = collapsedSections.has(cat)
                const subtotals = sectionTotals[cat] || {}
                const sectionTotal = periodKeys.reduce((sum, k) => sum + (subtotals[k] || 0), 0)

                globalRowIndex = 0

                return (
                  <React.Fragment key={cat}>
                    {/* Section header — values when collapsed, empty when expanded */}
                    <tr
                      className="cursor-pointer hover:bg-gray-100/40 dark:hover:bg-white/[0.04] transition-colors"
                      onClick={() => toggleSection(cat)}
                    >
                      <td className="py-2.5 pr-4 pl-4" style={stickyColStyle}>
                        <div className="flex items-center gap-1">
                          <div className="w-5 flex-shrink-0">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 theme-text-secondary" />
                            ) : (
                              <ChevronDown className="w-4 h-4 theme-text-secondary" />
                            )}
                          </div>
                          <span className="text-sm font-semibold theme-text-primary">{label}</span>
                          {isCollapsed && nonSummaryItems.length > 0 && (
                            <span className="text-[10px] theme-text-secondary ml-1">
                              ({nonSummaryItems.length})
                            </span>
                          )}
                        </div>
                      </td>
                      {periods.map((period, i) => {
                        const key = `period_${i}`
                        const val = subtotals[key] || 0
                        return (
                          <td
                            key={key}
                            className={cn(
                              'py-2.5 px-3 text-right text-sm font-mono whitespace-nowrap',
                              isCollapsed ? valueColorClass(val) : 'text-transparent',
                              !period.isHistorical && 'bg-amber-500/[0.02]',
                              dividerClass(i)
                            )}
                          >
                            {isCollapsed ? formatVal(val) : ''}
                          </td>
                        )
                      })}
                      <td
                        className={cn(
                          'py-2.5 px-3 text-right text-sm font-mono font-semibold whitespace-nowrap',
                          isCollapsed ? valueColorClass(sectionTotal) : 'text-transparent'
                        )}
                      >
                        {isCollapsed ? formatVal(sectionTotal) : ''}
                      </td>
                    </tr>

                    {!isCollapsed && nonSummaryItems.map((item) => renderLineItem(item, 1))}

                    {/* Section subtotal */}
                    {!isCollapsed && (
                      <tr className="border-t border-gray-200/5">
                        <td className="py-2.5 pr-4 pl-10" style={stickyColStyle}>
                          <span className="text-sm font-bold theme-text-primary">
                            Total {label}
                          </span>
                        </td>
                        {periods.map((period, i) => {
                          const key = `period_${i}`
                          const val = subtotals[key] || 0
                          return (
                            <td
                              key={key}
                              className={cn(
                                'py-2.5 px-3 text-right text-sm font-mono font-bold whitespace-nowrap',
                                valueColorClass(val),
                                !period.isHistorical && 'bg-amber-500/[0.02]',
                                dividerClass(i)
                              )}
                            >
                              {formatVal(val)}
                            </td>
                          )
                        })}
                        <td
                          className={cn(
                            'py-2.5 px-3 text-right text-sm font-mono font-bold whitespace-nowrap',
                            valueColorClass(sectionTotal)
                          )}
                        >
                          {formatVal(sectionTotal)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}

              {/* Net Change */}
              <tr className="border-t border-gray-200/8">
                <td className="py-2.5 pr-4 pl-6" style={stickyColStyle}>
                  <span className="text-sm font-bold theme-text-primary">Net Change in Cash</span>
                </td>
                {periods.map((period, i) => {
                  const key = `period_${i}`
                  const val = grandTotals[key] || 0
                  return (
                    <td
                      key={key}
                      className={cn(
                        'py-2.5 px-3 text-right text-sm font-mono font-bold whitespace-nowrap',
                        valueColorClass(val),
                        !period.isHistorical && 'bg-amber-500/[0.02]',
                        dividerClass(i)
                      )}
                    >
                      {formatVal(val)}
                    </td>
                  )
                })}
                <td
                  className={cn(
                    'py-2.5 px-3 text-right text-sm font-mono font-bold whitespace-nowrap',
                    valueColorClass(periodKeys.reduce((s, k) => s + (grandTotals[k] || 0), 0))
                  )}
                >
                  {formatVal(periodKeys.reduce((s, k) => s + (grandTotals[k] || 0), 0))}
                </td>
              </tr>

              {/* Ending Cash */}
              <tr className="bg-white/[0.02]">
                <td className="py-2.5 pr-4 pl-6" style={stickyColStyle}>
                  <span className="text-sm font-bold theme-text-primary">Ending Cash</span>
                </td>
                {periods.map((period, i) => (
                  <td
                    key={`period_${i}`}
                    className={cn(
                      'py-2.5 px-3 text-right text-sm font-mono font-bold whitespace-nowrap',
                      period.cumulativeCash >= 0 ? 'text-theme-green' : 'text-theme-red',
                      !period.isHistorical && 'bg-amber-500/[0.02]',
                      dividerClass(i)
                    )}
                  >
                    {formatVal(period.cumulativeCash)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right text-sm font-mono theme-text-secondary whitespace-nowrap">
                  &mdash;
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200/10">
          <div className="flex items-center justify-between text-[10px] theme-text-secondary">
            <span>{horizon === '13-week' ? 'Weekly' : 'Monthly'} forecast</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400/40 inline-block" /> Actual
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500/40 inline-block" /> Forecast
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
