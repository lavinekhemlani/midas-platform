'use client'

import { useEffect, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import { formatCompactCurrency, formatAxisCompact, formatPnLCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { ChartLegend } from '@/components/charts/ChartLegend'

interface MovementData {
  month: string
  entry_type: string
  total_quantity: number
  total_cost: number
  entry_count: number
}

interface InventoryMovementTrendCardProps {
  data: MovementData[]
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function InventoryMovementTrendCard({
  data,
  isLoading,
  currency = 'USD',
  tooltip,
  tooltipProps,
}: InventoryMovementTrendCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { splitLineStyle } = useThemeEChartsConfig()
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({})
  const [axisTextColor, setAxisTextColor] = useState('#94a3b8')

  useEffect(() => {
    const update = () => {
      const c = getComputedStyle(document.documentElement)
        .getPropertyValue('--theme-text-secondary')
        .trim()
      if (c) setAxisTextColor(c)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowBg: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
    }),
    [isLight]
  )

  // Colors matching the cash flow chart in summary page
  const purchaseColor = '#2BB5C6'  // cyan/teal — like Operating
  const salesColor = '#E879A0'     // pink — like Investing
  const adjustmentColor = '#F59E42' // amber — like Financing

  const legendItems = useMemo(
    () => [
      { name: 'Purchases', color: purchaseColor },
      { name: 'Sales', color: salesColor },
      { name: 'Adjustments', color: adjustmentColor },
    ],
    []
  )

  const handleLegendToggle = (name: string) => {
    setSelectedSeries((prev) => ({ ...prev, [name]: prev[name] === false ? true : false }))
  }

  // Group raw data by month and pivot entry_types into columns
  const formattedData = useMemo(() => {
    const monthMap = new Map<string, { purchases: number; sales: number; adjustments: number }>()

    for (const row of data) {
      const date = new Date(row.month)
      const monthKey = date.toISOString().slice(0, 7)

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { purchases: 0, sales: 0, adjustments: 0 })
      }

      const entry = monthMap.get(monthKey)!
      const entryType = (row.entry_type || '').toLowerCase()

      if (entryType.includes('purchase') || entryType.includes('positive')) {
        entry.purchases += Math.abs(row.total_cost)
      } else if (entryType.includes('sale') || entryType.includes('negative')) {
        entry.sales += Math.abs(row.total_cost)
      } else {
        entry.adjustments += Math.abs(row.total_cost)
      }
    }

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, values]) => {
        const date = new Date(monthKey + '-01')
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          purchases: values.purchases,
          sales: values.sales,
          adjustments: values.adjustments,
        }
      })
  }, [data])

  const totals = useMemo(() => {
    return {
      purchases: formattedData.reduce((sum, r) => sum + r.purchases, 0),
      sales: formattedData.reduce((sum, r) => sum + r.sales, 0),
      adjustments: formattedData.reduce((sum, r) => sum + r.adjustments, 0),
    }
  }, [formattedData])

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 300,
      animationEasing: 'quarticOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'quarticOut',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(38, 38, 38, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: isLight ? '#374151' : '#e5e7eb', fontSize: 12 },
        axisPointer: { type: 'line' as const, lineStyle: { color: 'transparent' } },
        formatter: (params: any[]) => {
          if (!params?.length) return ''
          const headerColor = isLight ? '#111827' : '#f8fafc'
          const labelColor = isLight ? '#6b7280' : '#94a3b8'
          const positiveColor = '#10B981'
          const negativeColor = '#EF4444'
          const borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
          let html = `<div style="font-weight:600;margin-bottom:6px;color:${headerColor}">${params[0].axisValue}</div>`
          let total = 0
          params.forEach((p: any) => {
            total += p.value || 0
            const c = p.value >= 0 ? positiveColor : negativeColor
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 0">
            <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="color:${labelColor}">${p.seriesName}</span></span>
            <span style="font-weight:500;font-family:monospace;color:${c}">${formatPnLCurrency(p.value, currency)}</span></div>`
          })
          html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${borderColor};display:flex;justify-content:space-between;gap:12px"><span style="color:${labelColor}">Total</span><span style="font-weight:700;font-family:monospace;color:${total >= 0 ? positiveColor : negativeColor}">${formatPnLCurrency(total, currency)}</span></div>`
          return html
        },
      },
      legend: {
        show: false,
        data: ['Purchases', 'Sales', 'Adjustments'],
        selected: selectedSeries,
      },
      grid: { left: '3%', right: '3%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: formattedData.map((d) => d.month),
        axisLabel: { color: axisTextColor, fontSize: 11, fontFamily: 'DM Sans, sans-serif' },
        axisLine: { lineStyle: { color: axisTextColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: axisTextColor,
          fontSize: 11,
          fontFamily: 'DM Sans, sans-serif',
          formatter: formatAxisCompact,
        },
        splitLine: { lineStyle: { color: splitLineStyle.color, type: 'dashed' } },
      },
      series: [
        {
          name: 'Purchases',
          type: 'bar',
          stack: 'movement',
          data: formattedData.map((d) => d.purchases),
          itemStyle: { color: purchaseColor },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: purchaseColor },
                  { offset: 1, color: `${purchaseColor}B3` },
                ],
              },
              borderColor: purchaseColor,
              borderWidth: 1,
            },
          },
          barMaxWidth: 32,
        },
        {
          name: 'Sales',
          type: 'bar',
          stack: 'movement',
          data: formattedData.map((d) => d.sales),
          itemStyle: { color: salesColor },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: salesColor },
                  { offset: 1, color: `${salesColor}B3` },
                ],
              },
              borderColor: salesColor,
              borderWidth: 1,
            },
          },
          barMaxWidth: 32,
        },
        {
          name: 'Adjustments',
          type: 'bar',
          stack: 'movement',
          data: formattedData.map((d) => d.adjustments),
          itemStyle: { color: adjustmentColor },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: adjustmentColor },
                  { offset: 1, color: `${adjustmentColor}B3` },
                ],
              },
              borderColor: adjustmentColor,
              borderWidth: 1,
            },
          },
          barMaxWidth: 32,
        },
      ],
    }),
    [formattedData, currency, isLight, axisTextColor, splitLineStyle, selectedSeries]
  )

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Movement Trend
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[200px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (formattedData.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Movement Trend
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No movement data available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Movement Trend
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : tooltip ? (
            <InfoTooltip content={tooltip} />
          ) : null}
        </div>
      </div>

      {/* Summary Row */}
      <div className={cn('py-2 px-2 -mx-2 mb-3', styles.rowBg)}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className={styles.textMuted}>Purchases: </span>
              <span className="font-mono font-semibold" style={{ color: purchaseColor }}>
                {formatCompactCurrency(totals.purchases, currency)}
              </span>
            </div>
            <div>
              <span className={styles.textMuted}>Sales: </span>
              <span className="font-mono font-semibold" style={{ color: salesColor }}>
                {formatCompactCurrency(totals.sales, currency)}
              </span>
            </div>
            <div>
              <span className={styles.textMuted}>Adj: </span>
              <span className="font-mono font-semibold" style={{ color: adjustmentColor }}>
                {formatCompactCurrency(totals.adjustments, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex flex-col">
        <ReactECharts
          option={option}
          style={{ width: '100%', height: 200 }}
          opts={canvasHighDpiOpts}
        />
        <div className="h-8 flex items-center justify-center">
          <ChartLegend
            items={legendItems}
            selected={selectedSeries}
            onToggle={handleLegendToggle}
            className="pt-0"
          />
        </div>
      </div>
    </div>
  )
}
