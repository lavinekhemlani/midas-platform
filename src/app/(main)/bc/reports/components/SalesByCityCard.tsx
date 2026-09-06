'use client'

import { useMemo, useEffect, useState } from 'react'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'

interface CitySalesRow {
  city: string
  country: string
  state: string
  totalAmount: number
  invoiceCount: number
  customerCount: number
}

interface SalesByCityCardProps {
  data: CitySalesRow[]
  currency: string
  isLoading?: boolean
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function SalesByCityCard({ data, currency, isLoading, tooltipProps }: SalesByCityCardProps) {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      setIsLight(document.documentElement.className.includes('theme-light'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const treemapOption = useMemo(() => {
    if (!data?.length) return null

    const countryMap: Record<
      string,
      { name: string; children: { name: string; value: number; invoiceCount: number }[] }
    > = {}

    for (const c of data) {
      if (c.city === '(unknown)') continue
      const country = c.country || 'Other'
      if (!countryMap[country]) countryMap[country] = { name: country, children: [] }
      countryMap[country].children.push({
        name: `${c.city}${c.state ? `, ${c.state}` : ''}`,
        value: c.totalAmount,
        invoiceCount: c.invoiceCount,
      })
    }

    Object.values(countryMap).forEach((country) => {
      country.children.sort((a, b) => b.value - a.value)
    })

    const countries = Object.values(countryMap).sort(
      (a, b) =>
        b.children.reduce((sum, c) => sum + c.value, 0) -
        a.children.reduce((sum, c) => sum + c.value, 0)
    )

    // Balanced warm-cool mix, theme-reactive
    const countryColors = isLight
      ? [
          '#2E78B5', // Blue
          '#C9553A', // Warm red
          '#D4922A', // Honey
          '#1A7A4C', // Emerald
          '#A85098', // Berry
          '#E08A3E', // Tangerine
          '#3A7D7E', // Teal
          '#B84A5E', // Raspberry
        ]
      : [
          '#5A9BD5', // Blue
          '#E07A5F', // Coral
          '#E5B44D', // Gold
          '#34B078', // Emerald
          '#C882BE', // Pink
          '#F0A45A', // Peach
          '#4DB8B0', // Teal
          '#D96070', // Rose
        ]

    const textColor = isLight ? '#111827' : '#F9FAFB'
    const mutedText = isLight ? '#6B7280' : '#9CA3AF'
    const borderColor = isLight ? '#E5E7EB' : '#374151'

    return {
      tooltip: {
        backgroundColor: isLight ? '#FFFFFF' : '#18181B',
        borderColor: borderColor,
        borderWidth: 1,
        borderRadius: 0,
        textStyle: {
          color: textColor,
          fontSize: 14,
          fontFamily: 'DM Sans, sans-serif',
          textShadowColor: 'transparent',
          textShadowBlur: 0,
        },
        padding: [10, 14],
        formatter: (p: any) => {
          if (p.data.children) {
            const total = p.data.children.reduce((sum: number, c: any) => sum + c.value, 0)
            return `<div style="font-weight:600;letter-spacing:-0.01em">${p.name}</div>
                    <div style="color:${mutedText};font-size:11px;margin-top:2px">${p.data.children.length} cities</div>
                    <div style="margin-top:8px;font-weight:600;font-size:14px">${formatCompactCurrency(total, currency)}</div>`
          }
          return `<div style="font-weight:600;letter-spacing:-0.01em">${p.name}</div>
                  <div style="margin-top:8px;display:flex;justify-content:space-between;gap:20px">
                    <span style="color:${mutedText}">Sales</span>
                    <span style="font-weight:600">${formatCompactCurrency(p.value || 0, currency)}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;gap:20px;margin-top:2px">
                    <span style="color:${mutedText}">Invoices</span>
                    <span style="font-weight:500">${p.data.invoiceCount || 0}</span>
                  </div>`
        },
      },
      series: [
        {
          type: 'treemap' as const,
          data: countries.map((c, idx) => ({
            name: c.name,
            children: c.children,
            ...(c.name === 'KW' ? { itemStyle: { color: isLight ? '#C45B8A' : '#D87EAB' } } : {}),
          })),
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: '{b}',
            fontSize: 12,
            fontWeight: 400,
            fontFamily: 'DM Sans, sans-serif',
            color: '#FFFFFF',
            textShadowColor: 'transparent',
            textShadowBlur: 0,
            padding: [3, 5],
          },
          upperLabel: {
            show: true,
            height: 22,
            color: isLight ? '#1a1a1a' : '#FFFFFF',
            fontSize: 11,
            fontWeight: 400,
            backgroundColor: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.25)',
            borderRadius: 0,
            padding: [4, 8],
            textShadowColor: 'rgba(0,0,0,0.4)',
            textShadowBlur: 1,
          },
          itemStyle: {
            borderColor: isLight ? '#FFFFFF' : '#09090B',
            borderWidth: 1,
            gapWidth: 0,
            borderRadius: 0,
          },
          levels: [
            {
              itemStyle: {
                borderColor: isLight ? '#FFFFFF' : '#09090B',
                borderWidth: 1,
                gapWidth: 0,
                borderRadius: 0,
              },
              upperLabel: { show: true },
              color: countryColors,
            },
            {
              colorSaturation: [0.5, 0.8],
              colorAlpha: [0.75, 0.95],
              itemStyle: {
                borderColor: isLight ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                borderWidth: 1,
                gapWidth: 0,
                borderRadius: 0,
              },
            },
          ],
        },
      ],
    }
  }, [data, currency, isLight])

  const cityCount = data?.filter((c) => c.city !== '(unknown)').length || 0
  const countryCount = new Set(
    data?.filter((c) => c.city !== '(unknown)').map((c) => c.country || 'Other')
  ).size

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={`relative text-base font-normal uppercase tracking-wider ${isLight ? 'text-stone-800' : 'text-stone-300'}`}
          >
            Sales by Location
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
          {cityCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {cityCount} cities / {countryCount} regions
            </span>
          )}
        </div>
        {isLoading && (
          <div className="h-3 w-3 border border-current border-t-transparent animate-spin theme-text-tertiary" />
        )}
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className={`h-16 animate-pulse ${isLight ? 'bg-stone-200' : 'bg-white/[0.04]'}`} />
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`h-8 animate-pulse ${isLight ? 'bg-stone-200' : 'bg-white/[0.04]'}`}
              />
            ))}
          </div>
        ) : treemapOption ? (
          <div className="h-[280px]">
            <ReactECharts
              option={treemapOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[180px] gap-2">
            <span className="text-xs theme-text-tertiary">No location data</span>
          </div>
        )}
      </div>
    </div>
  )
}
