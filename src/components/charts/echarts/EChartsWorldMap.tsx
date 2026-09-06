'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { X } from 'lucide-react'
import { ReactECharts } from '@/components/chat/visualizations/shared/ReactEChartsWrapper'
import { useTheme } from '@/hooks/useTheme'

// ── World GeoJSON source (ECharts 4.x CDN — stable, cached) ──
const WORLD_MAP_URL = 'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json'

// ── ISO 3166-1 alpha-2 → ECharts/Natural Earth country names ──
// Names verified against https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json
const ISO2_TO_NAME: Record<string, string> = {
  AF: 'Afghanistan',
  AL: 'Albania',
  DZ: 'Algeria',
  AD: 'Andorra',
  AO: 'Angola',
  AG: 'Antigua and Barb.',
  AR: 'Argentina',
  AM: 'Armenia',
  AU: 'Australia',
  AT: 'Austria',
  AZ: 'Azerbaijan',
  BS: 'Bahamas',
  BH: 'Bahrain',
  BD: 'Bangladesh',
  BB: 'Barbados',
  BY: 'Belarus',
  BE: 'Belgium',
  BZ: 'Belize',
  BJ: 'Benin',
  BT: 'Bhutan',
  BO: 'Bolivia',
  BA: 'Bosnia and Herz.',
  BW: 'Botswana',
  BR: 'Brazil',
  BN: 'Brunei',
  BG: 'Bulgaria',
  BF: 'Burkina Faso',
  BI: 'Burundi',
  KH: 'Cambodia',
  CM: 'Cameroon',
  CA: 'Canada',
  CV: 'Cape Verde',
  CF: 'Central African Rep.',
  TD: 'Chad',
  CL: 'Chile',
  CN: 'China',
  CO: 'Colombia',
  KM: 'Comoros',
  CD: 'Dem. Rep. Congo',
  CG: 'Congo',
  CR: 'Costa Rica',
  CI: "Côte d'Ivoire",
  HR: 'Croatia',
  CU: 'Cuba',
  CY: 'Cyprus',
  CZ: 'Czech Rep.',
  DK: 'Denmark',
  DJ: 'Djibouti',
  DM: 'Dominica',
  DO: 'Dominican Rep.',
  EC: 'Ecuador',
  EG: 'Egypt',
  SV: 'El Salvador',
  GQ: 'Eq. Guinea',
  ER: 'Eritrea',
  EE: 'Estonia',
  SZ: 'Swaziland',
  ET: 'Ethiopia',
  FJ: 'Fiji',
  FI: 'Finland',
  FR: 'France',
  GA: 'Gabon',
  GM: 'Gambia',
  GE: 'Georgia',
  DE: 'Germany',
  GH: 'Ghana',
  GR: 'Greece',
  GD: 'Grenada',
  GT: 'Guatemala',
  GN: 'Guinea',
  GW: 'Guinea-Bissau',
  GY: 'Guyana',
  HT: 'Haiti',
  HN: 'Honduras',
  HU: 'Hungary',
  IS: 'Iceland',
  IN: 'India',
  ID: 'Indonesia',
  IR: 'Iran',
  IQ: 'Iraq',
  IE: 'Ireland',
  IL: 'Israel',
  IT: 'Italy',
  JM: 'Jamaica',
  JP: 'Japan',
  JO: 'Jordan',
  KZ: 'Kazakhstan',
  KE: 'Kenya',
  KI: 'Kiribati',
  KP: 'Dem. Rep. Korea',
  KR: 'Korea',
  KW: 'Kuwait',
  KG: 'Kyrgyzstan',
  LA: 'Lao PDR',
  LV: 'Latvia',
  LB: 'Lebanon',
  LS: 'Lesotho',
  LR: 'Liberia',
  LY: 'Libya',
  LI: 'Liechtenstein',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MG: 'Madagascar',
  MW: 'Malawi',
  MY: 'Malaysia',
  MV: 'Maldives',
  ML: 'Mali',
  MT: 'Malta',
  MH: 'Marshall Is.',
  MR: 'Mauritania',
  MU: 'Mauritius',
  MX: 'Mexico',
  FM: 'Micronesia',
  MD: 'Moldova',
  MC: 'Monaco',
  MN: 'Mongolia',
  ME: 'Montenegro',
  MA: 'Morocco',
  MZ: 'Mozambique',
  MM: 'Myanmar',
  NA: 'Namibia',
  NR: 'Nauru',
  NP: 'Nepal',
  NL: 'Netherlands',
  NZ: 'New Zealand',
  NI: 'Nicaragua',
  NE: 'Niger',
  NG: 'Nigeria',
  MK: 'Macedonia',
  NO: 'Norway',
  OM: 'Oman',
  PK: 'Pakistan',
  PW: 'Palau',
  PS: 'Palestine',
  PA: 'Panama',
  PG: 'Papua New Guinea',
  PY: 'Paraguay',
  PE: 'Peru',
  PH: 'Philippines',
  PL: 'Poland',
  PT: 'Portugal',
  QA: 'Qatar',
  RO: 'Romania',
  RU: 'Russia',
  RW: 'Rwanda',
  WS: 'Samoa',
  SM: 'San Marino',
  ST: 'São Tomé and Principe',
  SA: 'Saudi Arabia',
  SN: 'Senegal',
  RS: 'Serbia',
  SC: 'Seychelles',
  SL: 'Sierra Leone',
  SG: 'Singapore',
  SK: 'Slovakia',
  SI: 'Slovenia',
  SB: 'Solomon Is.',
  SO: 'Somalia',
  ZA: 'South Africa',
  SS: 'S. Sudan',
  ES: 'Spain',
  LK: 'Sri Lanka',
  SD: 'Sudan',
  SR: 'Suriname',
  SE: 'Sweden',
  CH: 'Switzerland',
  SY: 'Syria',
  TJ: 'Tajikistan',
  TZ: 'Tanzania',
  TH: 'Thailand',
  TL: 'Timor-Leste',
  TG: 'Togo',
  TO: 'Tonga',
  TT: 'Trinidad and Tobago',
  TN: 'Tunisia',
  TR: 'Turkey',
  TM: 'Turkmenistan',
  TV: 'Tuvalu',
  UG: 'Uganda',
  UA: 'Ukraine',
  AE: 'United Arab Emirates',
  GB: 'United Kingdom',
  US: 'United States',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VU: 'Vanuatu',
  VE: 'Venezuela',
  VN: 'Vietnam',
  YE: 'Yemen',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
  // Territories not in world GeoJSON — will appear as unmapped cards
  // HK, TW, MO, PR, GU — not separate features in Natural Earth
}

export interface CountrySalesData {
  country: string // ISO 2-letter code or '(unknown)'
  totalAmount: number
  invoiceCount: number
  customerCount: number
  inferredCount?: number
  cities?: string[]
}

export interface WorldSalesMapProps {
  data: CountrySalesData[]
  height?: number
  formatCurrency?: (v: number) => string
}

const defaultFmt = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)

export function EChartsWorldMap({
  data,
  height = 720,
  formatCurrency = defaultFmt,
}: WorldSalesMapProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [mapReady, setMapReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pinnedCountry, setPinnedCountry] = useState<string | null>(null)
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)

  const [selectedPieces, setSelectedPieces] = useState<Set<number>>(new Set())

  // Fetch and register world map GeoJSON
  useEffect(() => {
    let cancelled = false
    async function loadMap() {
      try {
        const [echartsModule, response] = await Promise.all([
          import('echarts'),
          fetch(WORLD_MAP_URL),
        ])
        if (cancelled) return
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const geoJSON = await response.json()
        echartsModule.registerMap('world', geoJSON as any)
        setMapReady(true)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load map')
      }
    }
    loadMap()
    return () => {
      cancelled = true
    }
  }, [])

  // Separate known countries from unknown/EU
  const { mapData, unmappedEntries } = useMemo(() => {
    const mapped: Array<{
      name: string
      value: number
      isoCode: string
      invoiceCount: number
      customerCount: number
      inferredCount: number
      cities: string[]
    }> = []
    const unmapped: CountrySalesData[] = []

    for (const d of data) {
      const name = ISO2_TO_NAME[d.country]
      if (name) {
        mapped.push({
          name,
          value: d.totalAmount,
          isoCode: d.country,
          invoiceCount: d.invoiceCount,
          customerCount: d.customerCount,
          inferredCount: d.inferredCount || 0,
          cities: d.cities || [],
        })
      } else {
        unmapped.push(d)
      }
    }
    return { mapData: mapped, unmappedEntries: unmapped }
  }, [data])

  // Build pieces outside of option so the custom legend can access them
  // Single-hue amber gradient based on dashboard yellow (#f59e0b)
  // Light mode uses darker tints so the lowest range is visible on light backgrounds
  const pieces = useMemo(() => {
    if (!mapData.length) return []
    const maxVal = Math.max(...mapData.map((d) => d.value), 1)
    const lo = isLight ? '#f5d68aE6' : '#feecbfE6'
    if (maxVal <= 1000) {
      return [
        { min: 0, max: 100, label: '$0 – $100', color: lo },
        { min: 100, max: 500, label: '$100 – $500', color: '#f9bb4aE6' },
        { min: 500, max: 1000, label: '$500 – $1K', color: '#e87400E6' },
      ]
    }
    if (maxVal <= 50000) {
      return [
        { min: 0, max: 1000, label: '$0 – $1K', color: lo },
        { min: 1000, max: 5000, label: '$1K – $5K', color: '#fcd06eE6' },
        { min: 5000, max: 10000, label: '$5K – $10K', color: '#f9bb4aE6' },
        { min: 10000, max: 25000, label: '$10K – $25K', color: '#f59e0bE6' },
        { min: 25000, max: 50000, label: '$25K – $50K', color: '#e87400E6' },
      ]
    }
    return [
      { min: 0, max: 1000, label: '$0 – $1K', color: lo },
      { min: 1000, max: 10000, label: '$1K – $10K', color: '#fcd06eE6' },
      { min: 10000, max: 50000, label: '$10K – $50K', color: '#f9bb4aE6' },
      { min: 50000, max: 100000, label: '$50K – $100K', color: '#f59e0bE6' },
      { min: 100000, max: 250000, label: '$100K – $250K', color: '#e87400E6' },
      { min: 250000, label: '$250K+', color: '#d46200E6' },
    ]
  }, [mapData, isLight])

  // Count countries per piece for the legend
  const pieceCounts = useMemo(() => {
    return pieces.map((p) => {
      return mapData.filter((d) => {
        if (p.max != null) return d.value >= p.min && d.value < p.max
        return d.value >= p.min
      }).length
    })
  }, [pieces, mapData])

  const option = useMemo(() => {
    if (!mapReady || !mapData.length) return null

    // Theme-aware color palette
    const areaFill = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.12)'
    const areaBorder = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'

    // Build selected state for visualMap based on multi-select
    const selected: Record<string, boolean> = {}
    if (selectedPieces.size > 0) {
      pieces.forEach((_, i) => {
        selected[String(i)] = selectedPieces.has(i)
      })
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        show: false,
      },
      visualMap: {
        type: 'piecewise' as const,
        pieces,
        show: false,
        ...(selectedPieces.size > 0 ? { selected } : {}),
      },
      series: [
        {
          name: 'Sales',
          type: 'map' as const,
          map: 'world',
          roam: true,
          scaleLimit: { min: 1, max: 8 },
          zoom: 1.2,
          itemStyle: {
            areaColor: areaFill,
            borderColor: areaBorder,
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: {
              areaColor: isLight ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.5)',
              borderColor: 'rgba(245,158,11,0.8)',
              borderWidth: 1.5,
            },
            label: { show: false },
          },
          select: {
            itemStyle: {
              areaColor: isLight ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.7)',
              borderColor: '#f59e0b',
              borderWidth: 2,
            },
            label: { show: false },
          },
          selectedMode: 'single' as const,
          label: { show: false },
          data: mapData,
        },
      ],
    }
  }, [mapReady, mapData, isLight, pieces, selectedPieces])

  // Handle map country click — pins/unpins the country
  const onMapClick = useCallback(
    (params: any) => {
      if (params.componentType === 'series' && params.seriesType === 'map') {
        const entry = mapData.find((d) => d.name === params.name)
        if (entry) {
          setPinnedCountry((prev) => (prev === entry.isoCode ? null : entry.isoCode))
        } else {
          const iso = Object.entries(ISO2_TO_NAME).find(([, name]) => name === params.name)?.[0]
          if (iso) setPinnedCountry((prev) => (prev === iso ? null : iso))
        }
      }
    },
    [mapData]
  )

  // Handle mouseover — updates hovered country
  const onMapMouseover = useCallback(
    (params: any) => {
      if (params.componentType === 'series' && params.seriesType === 'map') {
        const entry = mapData.find((d) => d.name === params.name)
        if (entry) {
          setHoveredCountry(entry.isoCode)
        } else {
          // Country with no sales data — find ISO code from name
          const iso = Object.entries(ISO2_TO_NAME).find(([, name]) => name === params.name)?.[0]
          if (iso) setHoveredCountry(iso)
        }
      }
    },
    [mapData]
  )

  const onMapMouseout = useCallback(() => {
    setHoveredCountry(null)
  }, [])

  const mapEvents = useMemo(
    () => ({ click: onMapClick, mouseover: onMapMouseover, mouseout: onMapMouseout }),
    [onMapClick, onMapMouseover, onMapMouseout]
  )

  // Show pinned country if set, otherwise show hovered country
  const activeCountry = pinnedCountry || hoveredCountry
  const activeData = useMemo(() => {
    if (!activeCountry) return null
    return data.find((d) => d.country === activeCountry) || null
  }, [activeCountry, data])

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[200px] rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-sm text-red-400">Failed to load world map: {loadError}</p>
      </div>
    )
  }

  if (!mapReady) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-white/5 animate-pulse"
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs theme-text-secondary">Loading world map...</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Map */}
      {option && (
        <div
          className={`relative rounded-t-lg overflow-hidden border border-b-0 ${isLight ? 'border-black/10 bg-[#f0f4f8]' : 'border-white/10 bg-[#2a2a2a]'}`}
          style={{ height }}
        >
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={mapEvents}
          />
          {/* Unmapped regions overlay */}
          {unmappedEntries.length > 0 && (
            <div className="absolute bottom-3 left-3 max-w-[260px] z-10">
              <div
                className={`rounded-lg px-4 py-3 backdrop-blur-md border ${isLight ? 'bg-white/80 border-transparent' : 'bg-black/15 border-white/[0.08]'}`}
              >
                <p className="font-semibold theme-text-primary text-sm mb-2.5">Unmapped Regions</p>
                <div className="space-y-1">
                  {unmappedEntries.map((entry) => (
                    <div
                      key={entry.country}
                      className="flex items-center justify-between gap-8 text-[12px]"
                    >
                      <span className="theme-text-secondary truncate">
                        {entry.country === '(unknown)' ? 'Unknown' : entry.country}
                      </span>
                      <span className="theme-text-secondary opacity-70 tabular-nums whitespace-nowrap">
                        {formatCurrency(entry.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Country detail overlay — shows on hover, pins on click */}
          <div className="absolute top-3 right-3 max-w-[280px] z-10">
            <div
              className={`rounded-lg px-4 py-3 backdrop-blur-md border transition-opacity duration-150 ${isLight ? 'bg-white/80 border-transparent' : 'bg-black/15 border-white/[0.08]'} ${activeCountry ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              {activeCountry ? (
                <>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold theme-text-primary text-sm">
                        {ISO2_TO_NAME[activeCountry] || activeCountry}
                      </span>
                      <span
                        className={`text-[11px] font-mono ${isLight ? 'text-amber-600 bg-amber-600/15' : 'text-amber-400 bg-amber-500/20'} px-1.5 py-0.5 rounded`}
                      >
                        {activeCountry}
                      </span>
                    </div>
                    {pinnedCountry && (
                      <button
                        onClick={() => setPinnedCountry(null)}
                        className={`p-1 rounded ${isLight ? 'hover:bg-black/5' : 'hover:bg-white/10'} transition-colors`}
                      >
                        <X className="w-3.5 h-3.5 theme-text-secondary" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <p className="text-[10px] theme-text-secondary uppercase tracking-wider opacity-60">
                        Sales
                      </p>
                      <p
                        className={`text-sm font-semibold ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
                      >
                        {activeData ? formatCurrency(activeData.totalAmount) : '–'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] theme-text-secondary uppercase tracking-wider opacity-60">
                        Invoices
                      </p>
                      <p className="text-sm font-semibold theme-text-primary">
                        {activeData ? activeData.invoiceCount : '–'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] theme-text-secondary uppercase tracking-wider opacity-60">
                        Customers
                      </p>
                      <p className="text-sm font-semibold theme-text-primary">
                        {activeData ? activeData.customerCount : '–'}
                      </p>
                    </div>
                    {activeData && (activeData.inferredCount ?? 0) > 0 && (
                      <div>
                        <p
                          className={`text-[10px] uppercase tracking-wider opacity-60 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
                        >
                          Inferred
                        </p>
                        <p
                          className={`text-sm font-semibold ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
                        >
                          {activeData.inferredCount}
                        </p>
                      </div>
                    )}
                  </div>
                  {activeData?.cities && activeData.cities.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-current/5">
                      <p className="text-[10px] theme-text-secondary uppercase tracking-wider opacity-60 mb-1">
                        Cities
                      </p>
                      <p className="text-xs theme-text-secondary leading-relaxed">
                        {activeData.cities.slice(0, 6).join(', ')}
                        {activeData.cities.length > 6 && ` +${activeData.cities.length - 6} more`}
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Custom Radio Legend */}
      {pieces.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-4 justify-center px-4 py-3 rounded-b-lg border ${isLight ? 'border-black/10 bg-white/60' : 'border-white/10 bg-white/[0.03]'}`}
        >
          <span className="text-sm theme-text-primary font-normal">Filter by sales:</span>
          {pieces.map((piece, i) => {
            const isActive = selectedPieces.has(i)
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelectedPieces((prev) => {
                    const next = new Set(prev)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    return next
                  })
                }}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div
                  className="w-3.5 h-3.5 border-2 rounded-full flex items-center justify-center"
                  style={{ borderColor: piece.color }}
                >
                  {(selectedPieces.size === 0 || isActive) && (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: piece.color }}
                    />
                  )}
                </div>
                <span className="text-sm theme-text-secondary">{piece.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
