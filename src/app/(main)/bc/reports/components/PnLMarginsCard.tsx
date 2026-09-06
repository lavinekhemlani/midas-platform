'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'

interface PnLMarginsCardProps {
  pnlTotals: {
    totalRevenue: number
    totalCOGS: number
    grossProfit: number
    totalExpenses: number
    operatingExpenses?: number
    operatingIncome: number
    netIncome: number
    interestExpense?: number
    taxExpense?: number
    depreciationAmortization?: number
    ebitda?: number
  } | null
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

function MarginRow({
  label,
  amount,
  percentage,
  isPositive,
  currency,
  isLight,
  isEven,
  tooltip,
}: {
  label: string
  amount: number
  percentage: number | null
  isPositive: boolean
  currency: string
  isLight: boolean
  isEven: boolean
  tooltip?: Omit<InfoTooltipProps, 'className'>
}) {
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className={cn('flex items-center justify-between py-2.5 px-2 -mx-2 text-sm')}>
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'w-3.5 h-3.5',
            isPositive
              ? isLight
                ? 'text-green-600'
                : 'text-green-400'
              : isLight
                ? 'text-red-600'
                : 'text-red-400'
          )}
        />
        <span className={isLight ? 'text-stone-900' : 'text-white'}>{label}</span>
        {tooltip && <InfoTooltip {...tooltip} />}
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'text-[16px] font-mono font-semibold tabular-nums',
            isPositive
              ? isLight
                ? 'text-green-600'
                : 'text-green-400'
              : isLight
                ? 'text-red-600'
                : 'text-red-400'
          )}
        >
          {formatCompactCurrency(amount, currency)}
        </span>
        {percentage !== null && (
          <span
            className={cn(
              'text-[12px] font-mono font-semibold tabular-nums px-1.5 py-0.5',
              isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            )}
          >
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function PnLMarginsCard({
  pnlTotals,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: PnLMarginsCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  const grossMargin =
    pnlTotals && pnlTotals.totalRevenue !== 0
      ? (pnlTotals.grossProfit / pnlTotals.totalRevenue) * 100
      : null

  const operatingMargin =
    pnlTotals && pnlTotals.totalRevenue !== 0
      ? (pnlTotals.operatingIncome / pnlTotals.totalRevenue) * 100
      : null

  const netMargin =
    pnlTotals && pnlTotals.totalRevenue !== 0
      ? (pnlTotals.netIncome / pnlTotals.totalRevenue) * 100
      : null

  const rowTooltips = useMemo(() => {
    if (!pnlTotals) return { gross: undefined, operating: undefined, net: undefined }
    return {
      gross: {
        description:
          'Gross Profit is revenue minus Cost of Goods Sold (COGS). It shows how much profit remains after covering the direct costs of producing goods or services.',
        calculationTooltip: {
          formula: 'Gross Profit = Revenue − COGS\nGross Margin % = (Gross Profit ÷ Revenue) × 100',
          components: [
            { label: 'Revenue', value: formatCompactCurrency(pnlTotals.totalRevenue, currency) },
            { label: 'COGS', value: formatCompactCurrency(pnlTotals.totalCOGS, currency) },
            {
              label: 'Gross Profit',
              value: formatCompactCurrency(pnlTotals.grossProfit, currency),
              highlight: true,
            },
            ...(grossMargin !== null
              ? [{ label: 'Gross Margin', value: `${grossMargin.toFixed(1)}%`, highlight: true }]
              : []),
          ],
        },
        note: 'Source: BC Income Statement — Revenue accounts minus Cost of Goods Sold accounts.',
      },
      operating: {
        description:
          'Operating Income is Gross Profit minus Operating Expenses (salaries, rent, utilities, etc.). It measures the profit generated from core business operations, before any interest or tax charges.',
        calculationTooltip: {
          formula:
            'Operating Income = Gross Profit − Operating Expenses\n(or Revenue − COGS − Operating Expenses)\nOperating Margin % = (Operating Income ÷ Revenue) × 100',
          components: [
            { label: 'Revenue', value: formatCompactCurrency(pnlTotals.totalRevenue, currency) },
            { label: 'COGS', value: formatCompactCurrency(pnlTotals.totalCOGS, currency) },
            {
              label: 'Gross Profit',
              value: formatCompactCurrency(pnlTotals.grossProfit, currency),
            },
            {
              label: 'Operating Expenses',
              value: formatCompactCurrency(
                pnlTotals.operatingExpenses ?? pnlTotals.totalExpenses,
                currency
              ),
            },
            {
              label: 'Operating Income',
              value: formatCompactCurrency(pnlTotals.operatingIncome, currency),
              highlight: true,
            },
            ...(operatingMargin !== null
              ? [
                  {
                    label: 'Operating Margin',
                    value: `${operatingMargin.toFixed(1)}%`,
                    highlight: true,
                  },
                ]
              : []),
          ],
        },
        note: 'Source: BC Income Statement — Gross Profit minus operating Expense accounts (excludes interest & taxes).',
      },
      net: {
        description:
          'Net Income is the final bottom-line profit. It starts from Operating Income and then subtracts non-operating expenses (interest, taxes) and adds any non-operating income. It represents what the business actually earned.',
        calculationTooltip: {
          formula:
            'Net Income = Operating Income − Interest − Taxes\nNet Margin % = (Net Income ÷ Revenue) × 100',
          components: [
            {
              label: 'Operating Income',
              value: formatCompactCurrency(pnlTotals.operatingIncome, currency),
            },
            ...(pnlTotals.interestExpense
              ? [
                  {
                    label: 'Interest Expense',
                    value: formatCompactCurrency(pnlTotals.interestExpense, currency),
                  },
                ]
              : []),
            ...(pnlTotals.taxExpense
              ? [
                  {
                    label: 'Tax Expense',
                    value: formatCompactCurrency(pnlTotals.taxExpense, currency),
                  },
                ]
              : []),
            {
              label: 'Net Income',
              value: formatCompactCurrency(pnlTotals.netIncome, currency),
              highlight: true,
            },
            ...(netMargin !== null
              ? [{ label: 'Net Margin', value: `${netMargin.toFixed(1)}%`, highlight: true }]
              : []),
          ],
        },
        note: 'Source: BC Income Statement — Operating Income minus interest and tax expenses.',
      },
    }
  }, [pnlTotals, currency, grossMargin, operatingMargin, netMargin])

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Profit Margins
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn('h-10 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!pnlTotals) {
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
              Profit Margins
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No P&L data</p>
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
            Profit Margins
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      <MarginRow
        label="Gross Profit"
        amount={pnlTotals.grossProfit}
        percentage={grossMargin}
        isPositive={pnlTotals.grossProfit >= 0}
        currency={currency}
        isLight={isLight}
        isEven={true}
        tooltip={rowTooltips.gross}
      />
      <MarginRow
        label="Operating Income"
        amount={pnlTotals.operatingIncome}
        percentage={operatingMargin}
        isPositive={pnlTotals.operatingIncome >= 0}
        currency={currency}
        isLight={isLight}
        isEven={false}
        tooltip={rowTooltips.operating}
      />
      <MarginRow
        label="Net Income"
        amount={pnlTotals.netIncome}
        percentage={netMargin}
        isPositive={pnlTotals.netIncome >= 0}
        currency={currency}
        isLight={isLight}
        isEven={true}
        tooltip={rowTooltips.net}
      />
    </div>
  )
}
