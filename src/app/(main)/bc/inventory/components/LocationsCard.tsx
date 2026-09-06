'use client'

import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface LocationRow {
  code: string
  name: string
  address: string
  city: string
  state: string
  country: string
}

interface LocationsCardProps {
  data: LocationRow[]
  isLoading: boolean
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function LocationsCard({ data, isLoading, tooltip, tooltipProps }: LocationsCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowBg: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
    }),
    [isLight]
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
            Warehouse Locations
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[120px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Warehouse Locations
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No location data available</p>
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
            Warehouse Locations
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : tooltip ? (
            <InfoTooltip content={tooltip} />
          ) : null}
        </div>
        <span className={cn('text-xs font-mono', styles.textMuted)}>
          {data.length} location{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Locations List */}
      <div className={cn('border-t pt-2 max-h-[200px] overflow-y-auto', styles.border)}>
        {data.map((loc, index) => {
          const locationParts = [loc.city, loc.state, loc.country].filter(Boolean)
          return (
            <div
              key={loc.code}
              className={cn(
                'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
                index % 2 === 0 && styles.rowBg
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MapPin className="w-3 h-3 text-teal-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-teal-500">{loc.code}</span>
                    <span className={cn('font-medium truncate', styles.text)}>{loc.name}</span>
                  </div>
                  {(loc.address || locationParts.length > 0) && (
                    <p className={cn('text-[10px] truncate', styles.textMuted)}>
                      {[loc.address, locationParts.join(', ')].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
