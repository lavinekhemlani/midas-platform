'use client'

import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { ProviderSnapshot } from '../hooks/useDashboardQBData'

// ─── Metric Row ─────────────────────────────────────────────

function MetricRow({
  label,
  value,
  currency,
  change,
  isLoading,
}: {
  label: string
  value: number | null
  currency: string
  change?: number | null
  isLoading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs theme-text-secondary whitespace-nowrap opacity-70">{label}</span>
      <div className="flex items-center gap-2.5">
        {change != null && !isLoading && value != null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md ${
              change >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            }`}
          >
            {change >= 0 ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {isLoading && value == null ? (
          <Skeleton className="h-4 w-16 rounded" />
        ) : value != null ? (
          <span className="text-[13px] font-mono font-semibold theme-text-primary tabular-nums tracking-tight">
            {formatCompactCurrency(value, currency)}
          </span>
        ) : (
          <span className="text-[13px] font-mono theme-text-secondary opacity-40">--</span>
        )}
      </div>
    </div>
  )
}

// ─── Health Radar ───────────────────────────────────────────

function HealthRadar({
  components,
  score,
  rating,
  color,
  isDark,
  isLoading,
  providerId,
}: {
  components: {
    liquidity: number
    profitability: number
    efficiency: number
    leverage: number
  } | null
  score: number | null
  rating: string | null
  color: string
  isDark: boolean
  isLoading: boolean
  providerId?: string
}) {
  const ghostColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
  const isEcommerce = providerId === 'shopify'

  const indicators = isEcommerce
    ? [
        { name: 'Cash Flow', max: 100 },
        { name: 'Margin', max: 100 },
        { name: 'AOV', max: 100 },
        { name: 'Retention', max: 100 },
      ]
    : [
        { name: 'Liquidity', max: 100 },
        { name: 'Profit', max: 100 },
        { name: 'Efficiency', max: 100 },
        { name: 'Leverage', max: 100 },
      ]

  const option = {
    radar: {
      indicator: indicators,
      shape: 'circle' as const,
      radius: '62%',
      center: ['50%', '50%'],
      axisName: {
        color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
        fontSize: 9,
      },
      splitArea: { show: false },
      splitLine: {
        lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
      },
      axisLine: {
        lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: components
              ? [
                  components.liquidity,
                  components.profitability,
                  components.efficiency,
                  components.leverage,
                ]
              : [0, 0, 0, 0],
            name: 'Health',
          },
        ],
        symbol: 'circle',
        symbolSize: 3,
        lineStyle: {
          color: components ? color : ghostColor,
          width: 2,
        },
        areaStyle: {
          color: components ? `${color}20` : `${ghostColor}`,
        },
        itemStyle: {
          color: components ? color : ghostColor,
        },
      },
    ],
    grid: { top: 0, bottom: 0, left: 0, right: 0 },
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-full h-[140px] ${isLoading && !components ? 'animate-pulse opacity-40' : ''}`}
      >
        <ReactECharts
          option={option}
          style={{ width: '100%', height: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
      {isLoading && score == null ? (
        <Skeleton className="h-5 w-20 mt-1" />
      ) : score != null ? (
        <Badge
          variant="outline"
          className="text-xs mt-1 font-semibold uppercase tracking-wider px-2 py-0.5"
          style={{
            borderColor: `${color}40`,
            color,
            backgroundColor: `${color}10`,
          }}
        >
          {Math.round(score)} / {rating || 'N/A'}
        </Badge>
      ) : (
        <span className="text-xs theme-text-secondary mt-1">No data</span>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function FinancialSnapshot({
  snapshot,
  providerColor,
  isDark,
  providerId,
}: {
  snapshot: ProviderSnapshot
  providerColor: string
  isDark: boolean
  providerId?: string
}) {
  const currency = snapshot.currency || 'USD'
  const { isLoading } = snapshot
  const isRefreshing = snapshot.isValidating && !isLoading

  // E-commerce providers use different metric labels
  const isEcommerce = providerId === 'shopify'
  const labels = isEcommerce
    ? { netIncome: 'Net Revenue', cash: 'Payments Balance', ar: 'Avg Order Value', ap: 'Refunds' }
    : { netIncome: 'Net Income', cash: 'Cash', ar: 'Aged Receivables', ap: 'Aged Payables' }

  return (
    <div
      className={`financial-snapshot flex flex-col @md:flex-row gap-5 @md:gap-6 transition-opacity duration-300 ${isRefreshing ? 'opacity-60' : ''}`}
    >
      {/* KPI Strip */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium tracking-[0.12em] uppercase theme-text-secondary opacity-60 mb-3 flex items-center gap-2">
          Key Metrics
          {isRefreshing && <RefreshCw className="w-3 h-3 animate-spin theme-text-secondary" />}
        </p>
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-black/[0.06]'}`}>
          <MetricRow
            label="Revenue"
            value={snapshot.revenue}
            currency={currency}
            change={snapshot.revenueChange}
            isLoading={isLoading}
          />
          <MetricRow
            label="Gross Profit"
            value={snapshot.grossProfit}
            currency={currency}
            change={snapshot.grossProfitChange}
            isLoading={isLoading}
          />
          <MetricRow
            label={labels.netIncome}
            value={snapshot.netIncome}
            currency={currency}
            change={snapshot.netIncomeChange}
            isLoading={isLoading}
          />
          <MetricRow
            label={labels.cash}
            value={snapshot.cashBalance}
            currency={currency}
            isLoading={isLoading}
          />
          {!isEcommerce && (
            <>
              <MetricRow
                label={labels.ar}
                value={snapshot.ar}
                currency={currency}
                isLoading={isLoading}
              />
              <MetricRow
                label={labels.ap}
                value={snapshot.ap}
                currency={currency}
                isLoading={isLoading}
              />
            </>
          )}
        </div>
      </div>

      {/* Health Radar */}
      <div className="w-full @md:w-[180px] flex-shrink-0">
        <p className="text-xs font-medium tracking-[0.12em] uppercase theme-text-secondary mb-3 text-center opacity-60">
          Health Score
        </p>
        <HealthRadar
          components={snapshot.healthComponents}
          score={snapshot.healthScore}
          rating={snapshot.healthRating}
          color={providerColor}
          isDark={isDark}
          isLoading={isLoading}
          providerId={providerId}
        />
      </div>
    </div>
  )
}
