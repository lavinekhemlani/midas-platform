'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { InfoTooltipBody } from '@/components/ui/InfoTooltipBody'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface KPICardData {
  value: number
  changePercent?: number | null
  sparkline?: number[]
}

export interface KPICardConfig {
  label: string
  kpi: KPICardData
  format: (v: number) => string
  invertChange?: boolean
  valueColor?: string
  tooltip?: Pick<InfoTooltipProps, 'content' | 'description' | 'calculationTooltip' | 'note'>
}

export interface KPIStripProps {
  cards: KPICardConfig[]
  isLoading?: boolean
  isLight: boolean
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null

  const width = 64
  const height = 20
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path
        d={`M ${points.join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KPICard({
  label,
  kpi,
  format,
  invertChange,
  valueColor,
  tooltip,
  isLight,
}: KPICardConfig & { isLight: boolean }) {
  const { value, changePercent, sparkline } = kpi
  const hasChange = changePercent !== null && changePercent !== undefined

  const isPositive = hasChange ? (invertChange ? changePercent! < 0 : changePercent! > 0) : false
  const isNegative = hasChange ? (invertChange ? changePercent! > 0 : changePercent! < 0) : false

  const changeColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : isNegative
      ? 'text-red-500 dark:text-red-400'
      : 'text-stone-400 dark:text-gray-500'

  const sparklineColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#94a3b8'

  const cardContent = (
    <div
      className={cn(
        'group/kpi flex flex-col gap-1.5 px-5 py-4',
        isLight
          ? 'bg-stone-200/60'
          : 'bg-white/[0.08]'
      )}
    >
      <span
        className={cn(
          'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline',
          isLight ? 'text-stone-500' : 'text-gray-400'
        )}
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'text-[22px] font-semibold font-mono tabular-nums leading-none',
            valueColor || (isLight ? 'text-stone-900' : 'text-white')
          )}
        >
          {format(value)}
        </span>
        <div className="flex items-center gap-2">
          {sparkline && <Sparkline data={sparkline} color={sparklineColor} />}
          {hasChange && (
            <span className={cn('flex items-center gap-0.5 text-[12px] font-medium', changeColor)}>
              {changePercent! > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : changePercent! < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
              {Math.abs(changePercent!)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (!tooltip) return cardContent

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="kpi-tooltip text-xs rounded-lg shadow-xl border z-[100] w-72 p-3 max-w-none"
        >
          <InfoTooltipBody {...tooltip} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function Skeleton({ count, isLight }: { count: number; isLight: boolean }) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col gap-2 px-5 py-4 min-w-[240px] shrink-0 snap-start',
            isLight
              ? 'bg-stone-200/60'
              : 'bg-white/[0.08]'
          )}
        >
          <div
            className={cn(
              'h-3 w-16 rounded animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
            )}
          />
          <div
            className={cn(
              'h-7 w-24 rounded animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
            )}
          />
        </div>
      ))}
    </div>
  )
}

export function KPIStrip({ cards, isLoading, isLight }: KPIStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll, cards])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' })
  }

  if (isLoading) return <Skeleton count={cards.length || 4} isLight={isLight} />

  return (
    <div className="grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 gap-3">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} isLight={isLight} />
      ))}
    </div>
  )
}
