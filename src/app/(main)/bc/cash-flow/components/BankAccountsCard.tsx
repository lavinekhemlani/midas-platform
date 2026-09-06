'use client'

import { useMemo } from 'react'
import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'

export interface BankAccount {
  no: string
  name: string
  balance_lcy: number
  currency_code: string
}

interface BankAccountsCardProps {
  accounts: BankAccount[]
  totalCash?: number
  isLoading: boolean
  currency?: string
  isLight?: boolean
}

export function BankAccountsCard({
  accounts,
  totalCash: propTotalCash,
  isLoading,
  currency = 'USD',
  isLight: isLightProp,
}: BankAccountsCardProps) {
  const { theme } = useTheme()
  const isLight = isLightProp ?? theme === 'light'

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      rowEven: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
    }),
    [isLight]
  )

  const calculatedTotal = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance_lcy, 0)
  }, [accounts])
  const totalCash = propTotalCash ?? calculatedTotal

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => b.balance_lcy - a.balance_lcy)
  }, [accounts])

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
            Bank Accounts
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div className="space-y-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={cn('h-12 animate-pulse', isLight ? 'bg-stone-100/70' : 'bg-white/[0.02]')}
            />
          ))}
        </div>
      </div>
    )
  }

  if (sortedAccounts.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Bank Accounts
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No bank accounts configured</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Bank Accounts
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <span
          className={cn(
            'text-xs font-mono px-2 py-1',
            isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.04] text-stone-400'
          )}
        >
          {sortedAccounts.length} {sortedAccounts.length === 1 ? 'account' : 'accounts'}
        </span>
      </div>

      {/* Scrollable accounts list */}
      <div
        className={cn(
          'max-h-[320px] overflow-y-auto overflow-x-hidden pr-1',
          '[&::-webkit-scrollbar]:w-1.5',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-track]:rounded-full',
          isLight
            ? '[&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded-full'
            : '[&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-thumb]:rounded-full'
        )}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
        }}
      >
        {sortedAccounts.map((account, i) => {
          const percentage = totalCash !== 0 ? Math.abs((account.balance_lcy / totalCash) * 100) : 0
          return (
            <div
              key={account.no}
              className={cn(
                'flex items-center gap-3 py-2.5 px-2 -mx-2 text-xs transition-colors',
                i % 2 === 0 ? styles.rowEven : '',
                styles.rowHover
              )}
            >
              {/* Percentage indicator */}
              <div
                className="w-2 h-2 flex-shrink-0"
                style={{
                  backgroundColor:
                    account.balance_lcy >= 0
                      ? isLight
                        ? '#22c55e'
                        : '#4ade80'
                      : isLight
                        ? '#ef4444'
                        : '#f87171',
                }}
              />

              {/* Account info */}
              <div className="flex-1 min-w-0">
                <span
                  className={cn('font-medium truncate block text-[13px]', styles.text)}
                  title={account.name}
                >
                  {account.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className={cn('font-mono text-[10px]', styles.textMuted)}>
                    {account.no}
                  </span>
                  {account.currency_code && account.currency_code !== currency && (
                    <span
                      className={cn(
                        'text-[9px] px-1 py-0.5',
                        isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/[0.06] text-stone-400'
                      )}
                    >
                      {account.currency_code}
                    </span>
                  )}
                </div>
              </div>

              {/* Balance and percentage */}
              <div className="text-right flex-shrink-0">
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums text-[13px] block',
                    account.balance_lcy >= 0
                      ? styles.text
                      : isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                  )}
                >
                  {formatPnLCurrency(account.balance_lcy, currency)}
                </span>
                <span className={cn('font-mono text-[10px]', styles.textMuted)}>
                  {percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total row */}
      <div
        className={cn(
          'flex items-center justify-between py-3 px-2 -mx-2 mt-3 border-t text-xs',
          styles.border
        )}
      >
        <div className="flex items-center gap-2">
          <Wallet className={cn('w-4 h-4', isLight ? 'text-green-600' : 'text-green-400')} />
          <span className={cn('font-semibold', styles.text)}>Total Cash Position</span>
        </div>
        <span
          className={cn(
            'text-lg font-mono font-bold tabular-nums',
            totalCash >= 0
              ? isLight
                ? 'text-green-600'
                : 'text-green-400'
              : isLight
                ? 'text-red-600'
                : 'text-red-400'
          )}
        >
          {formatPnLCurrency(totalCash, currency)}
        </span>
      </div>
    </div>
  )
}
