'use client'

import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'
import type { ABCClassification } from '../../hooks/useBCInventoryEnhanced'

interface ABCClassificationCardProps {
  data: ABCClassification
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

const CLASS_CONFIG = {
  A: {
    label: 'A — High Value',
    barColor: '#f59e0b',
  },
  B: {
    label: 'B — Medium Value',
    barColor: '#3b82f6',
  },
  C: {
    label: 'C — Low Value',
    barColor: '#6b7280',
  },
} as const

export function ABCClassificationCard({
  data,
  isLoading,
  currency = 'USD',
  tooltip,
  tooltipProps,
}: ABCClassificationCardProps) {
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

  const totalItems = data.A.count + data.B.count + data.C.count

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
            ABC Classification
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[150px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            ABC Classification
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No items to classify</p>
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
            ABC Classification
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : (
            <InfoTooltip
              content={
                tooltip ||
                'ABC analysis ranks items by inventory value using the Pareto principle. ' +
                  'Class A = top 80% of total value, Class B = next 15%, Class C = remaining 5%.'
              }
            />
          )}
        </div>
        <span className={cn('text-[12px] font-mono', styles.textMuted)}>{totalItems} items</span>
      </div>

      {/* Classes */}
      <div className={cn('border-t pt-2', styles.border)}>
        {(['A', 'B', 'C'] as const).map((cls, index) => {
          const config = CLASS_CONFIG[cls]
          const classData = data[cls]
          const countPct = totalItems > 0 ? (classData.count / totalItems) * 100 : 0

          return (
            <div key={cls} className="py-2.5 px-2 -mx-2">
              <div className="flex items-center justify-between text-[14px] mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: config.barColor }}>
                    {config.label}
                  </span>
                  <span className={styles.textMuted}>
                    {classData.count} items ({countPct.toFixed(0)}% of SKUs)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[12px] font-medium px-1 py-0.5"
                    style={{ color: config.barColor, backgroundColor: `${config.barColor}15` }}
                  >
                    {classData.percentage.toFixed(1)}%
                  </span>
                  <span
                    className={cn('text-[16px] font-mono font-semibold tabular-nums', styles.text)}
                  >
                    {formatCompactCurrency(classData.totalValue, currency)}
                  </span>
                </div>
              </div>
              <div className={cn('h-1.5 w-full', isLight ? 'bg-stone-300' : 'bg-white/[0.10]')}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.max(2, classData.percentage)}%`,
                    backgroundColor: config.barColor,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
