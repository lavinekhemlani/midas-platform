'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface AccountActivity {
  account: string
  debit: number
  credit: number
  total: number
  count: number
}

interface AccountActivityStripProps {
  data: AccountActivity[]
  isLoading: boolean
  totalVolume: number
}

const barColors = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
]

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      <div className={cn('h-6 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
      <div className="space-y-1">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={cn('h-4 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
          />
        ))}
      </div>
    </div>
  )
}

export function AccountActivityStrip({ data, isLoading, totalVolume }: AccountActivityStripProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.04]',
      debit: isLight ? 'text-emerald-600' : 'text-emerald-400',
      credit: isLight ? 'text-blue-600' : 'text-blue-400',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data.length) {
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No account data</div>
  }

  // Calculate metrics
  const topAccount = data[0]
  const top5Total = data.slice(0, 5).reduce((sum, a) => sum + a.total, 0)
  const top5Percentage = totalVolume > 0 ? (top5Total / totalVolume) * 100 : 0
  const totalEntries = data.reduce((sum, a) => sum + a.count, 0)

  // Calculate bar widths
  const barData = data.slice(0, 8)
  const barTotal = barData.reduce((sum, a) => sum + a.total, 0)
  const othersTotal = totalVolume - barTotal
  const othersPercentage = totalVolume > 0 ? (othersTotal / totalVolume) * 100 : 0

  return (
    <div>
      {/* Metrics row */}
      <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Top </span>
          <span
            className={cn(
              'font-mono font-medium truncate max-w-[100px] inline-block align-bottom',
              styles.text
            )}
            title={topAccount?.account}
          >
            {topAccount?.account?.split(':').pop() || '-'}
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Top 5 </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {top5Percentage.toFixed(0)}%
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Entries </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {totalEntries.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className={cn('h-6 flex overflow-hidden mb-3', styles.barBg)}>
        {barData.map((account, i) => {
          const width = totalVolume > 0 ? (account.total / totalVolume) * 100 : 0
          if (width < 0.5) return null
          return (
            <div
              key={account.account}
              className={cn(
                barColors[i % barColors.length],
                'h-full transition-all relative group'
              )}
              style={{ width: `${width}%` }}
              title={`${account.account}: ${formatCompactCurrency(account.total, 'USD')} (${width.toFixed(1)}%)`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/90">
                  {width.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
        {othersPercentage > 0.5 && (
          <div
            className={cn('h-full', isLight ? 'bg-stone-300' : 'bg-stone-600')}
            style={{ width: `${othersPercentage}%` }}
            title={`Others: ${formatCompactCurrency(othersTotal, 'USD')}`}
          />
        )}
      </div>

      {/* Account list */}
      <div className="space-y-px">
        {data.slice(0, 8).map((account, i) => (
          <div
            key={account.account}
            className={cn(
              'flex items-center gap-3 py-1.5 px-2 -mx-2 text-xs transition-colors',
              i % 2 === 0 ? (isLight ? 'bg-stone-50/50' : 'bg-white/[0.01]') : '',
              isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.05]'
            )}
          >
            <div className={cn('w-2 h-2 flex-shrink-0', barColors[i % barColors.length])} />
            <span className={cn('flex-1 truncate', styles.text)} title={account.account}>
              {account.account}
            </span>
            <span className={cn('font-mono tabular-nums', styles.debit)}>
              {account.debit > 0 ? formatCompactCurrency(account.debit, 'USD') : '—'}
            </span>
            <span className={cn('font-mono tabular-nums', styles.credit)}>
              {account.credit > 0 ? formatCompactCurrency(account.credit, 'USD') : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className={cn('flex gap-4 pt-3 mt-3 border-t text-[10px]', styles.border)}>
        <div className="flex items-center gap-1.5">
          <div
            className={cn('w-2 h-2 rounded-full', isLight ? 'bg-emerald-500' : 'bg-emerald-400')}
          />
          <span className={styles.textMuted}>Debit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full', isLight ? 'bg-blue-500' : 'bg-blue-400')} />
          <span className={styles.textMuted}>Credit</span>
        </div>
      </div>
    </div>
  )
}
