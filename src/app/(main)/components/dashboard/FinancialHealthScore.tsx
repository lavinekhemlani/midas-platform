// src/app/(main)/components/FinancialHealthScore.tsx
'use client'

import { useState } from 'react'
import { Heart, HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency, getCurrencySymbol } from '@/lib/utils/currency'
import { useCurrency } from '@/contexts/CurrencyContext'
import { getMetricById, FINANCIAL_METRICS } from '@/lib/data/financialMetrics'
import { useTheme } from '@/hooks/useTheme'
import type { KPIData } from '@/types/reports'

interface HealthMetric {
  name: string
  score: number
  weight: number
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  description: string
  value?: number
  unit?: string
}

interface DashboardMetricsData {
  kpis: KPIData[]
  currency?: string
}

interface FinancialHealthScoreProps {
  score: number
  metrics: DashboardMetricsData
  selectedMetrics?: string[] // Array of selected financial health metric IDs
  className?: string
  isLoading?: boolean
}

export default function FinancialHealthScore({
  score,
  metrics,
  selectedMetrics,
  className,
  isLoading = false,
}: FinancialHealthScoreProps) {
  const { currency } = useCurrency()
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'
  const [showTooltip, setShowTooltip] = useState(false)

  // Use default metrics if none selected
  const defaultMetrics = ['cash_runway', 'gross_margin', 'cash_flow', 'cash_balance']
  const metricsToShow =
    selectedMetrics && selectedMetrics.length === 4 ? selectedMetrics : defaultMetrics

  // Check if we have actual data
  const hasData = metrics?.kpis && metrics.kpis.length > 0 && !isLoading

  // Get metric value from KPI data using mapping
  const getMetricValue = (metricId: string): number => {
    // Map financial metric IDs to KPI metric names
    const metricMapping: Record<string, string> = {
      // Liquidity Metrics
      cash_runway: 'runway_months',
      cash_balance: 'cash_balance',
      cash_flow: 'ocf',
      working_capital: 'working_capital',
      free_cash_flow: 'free_cash_flow',
      burn_rate: 'burn_rate', // Gross burn rate
      net_burn_rate: 'net_burn_rate', // Net burn rate
      operating_cash_flow_ratio: 'ocf_ratio',

      // Profitability Metrics
      gross_margin: 'gross_margin_pct',
      net_profit_margin: 'net_profit_margin',
      operating_margin: 'operating_margin',
      return_on_equity: 'roe',
      return_on_assets: 'roa',
      operating_cash_flow_margin: 'ocf_margin',

      // Efficiency Metrics
      working_capital_ratio: 'current_ratio',
      quick_ratio: 'quick_ratio',
      cash_conversion_cycle: 'cash_conversion_cycle',
      asset_turnover: 'asset_turnover',
      inventory_turnover: 'inventory_turns',
      days_sales_outstanding: 'dso',
      days_payable_outstanding: 'dpo',

      // Leverage Metrics
      debt_to_equity_ratio: 'debt_to_equity',
      debt_ratio: 'debt_ratio',
      equity_multiplier: 'equity_multiplier',
      cash_flow_coverage: 'cash_flow_coverage',

      // SaaS Metrics
      mrr: 'mrr',
      arr: 'arr',
      mrr_growth_rate: 'mrr_growth_rate',
      customer_churn_rate: 'customer_churn_rate',
      revenue_churn_rate: 'revenue_churn_rate',
      net_revenue_retention: 'nrr',
      gross_revenue_retention: 'grr',
      customer_acquisition_cost: 'cac',
      customer_lifetime_value: 'ltv',
      ltv_cac_ratio: 'ltv_cac_ratio',
      arpu: 'arpu',
      magic_number: 'magic_number',
      rule_of_40: 'rule_of_40',

      // E-commerce/Retail Metrics
      average_order_value: 'aov',
      revenue_growth_rate: 'revenue_growth',
    }

    const kpiMetricName = metricMapping[metricId] || metricId
    const kpi = metrics.kpis?.find((k: KPIData) => k.metric === kpiMetricName)
    return typeof kpi?.value === 'number' ? kpi.value : 0
  }

  // Generic metric score calculation function
  const calculateMetricScore = (
    metricId: string,
    value: number
  ): { score: number; status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' } => {
    // For placeholder values, we'll use simple rules
    // In a real implementation, these would be more sophisticated based on industry benchmarks

    switch (metricId) {
      case 'cash_runway':
        return { score: calculateRunwayScore(value), status: getRunwayStatus(value) }
      case 'gross_margin':
        return { score: calculateMarginScore(value), status: getMarginStatus(value) }
      case 'cash_flow':
        return { score: calculateCashFlowScore(value), status: getCashFlowStatus(value) }
      case 'cash_balance':
        return { score: calculateCashBalanceScore(value), status: getCashBalanceStatus(value) }

      // Placeholder scoring for new metrics - these can be refined later
      case 'mrr_growth_rate':
      case 'revenue_growth_rate':
      case 'subscriber_growth_rate':
      case 'active_users_growth':
      case 'licensing_revenue_growth':
        // Growth rate scoring (percentage)
        if (value >= 20) return { score: 100, status: 'excellent' }
        if (value >= 10) return { score: 85, status: 'good' }
        if (value >= 5) return { score: 70, status: 'fair' }
        if (value >= 0) return { score: 50, status: 'poor' }
        return { score: 25, status: 'critical' }

      case 'customer_churn_rate':
        // Churn rate scoring (lower is better)
        if (value <= 2) return { score: 100, status: 'excellent' }
        if (value <= 5) return { score: 85, status: 'good' }
        if (value <= 10) return { score: 70, status: 'fair' }
        if (value <= 15) return { score: 50, status: 'poor' }
        return { score: 25, status: 'critical' }

      case 'conversion_rate':
        // Conversion rate scoring (percentage)
        if (value >= 15) return { score: 100, status: 'excellent' }
        if (value >= 10) return { score: 85, status: 'good' }
        if (value >= 5) return { score: 70, status: 'fair' }
        if (value >= 2) return { score: 50, status: 'poor' }
        return { score: 25, status: 'critical' }

      case 'inventory_turnover':
        // Inventory turnover scoring (higher is generally better)
        if (value >= 12) return { score: 100, status: 'excellent' }
        if (value >= 8) return { score: 85, status: 'good' }
        if (value >= 6) return { score: 70, status: 'fair' }
        if (value >= 4) return { score: 50, status: 'poor' }
        return { score: 25, status: 'critical' }

      default:
        // Generic scoring for unknown metrics - assume higher is better
        const normalizedValue = Math.min(Math.max(value / 100, 0), 1)
        const score = Math.round(normalizedValue * 100)
        let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
        if (score >= 80) status = 'excellent'
        else if (score >= 60) status = 'good'
        else if (score >= 40) status = 'fair'
        else if (score >= 20) status = 'poor'
        else status = 'critical'
        return { score, status }
    }
  }

  // Calculate individual health metrics based on selected metrics
  const healthMetrics: HealthMetric[] = metricsToShow.map((metricId, index) => {
    const metricDef = getMetricById(metricId)
    const value = getMetricValue(metricId)

    if (!metricDef) {
      // Fallback for unknown metrics
      return {
        name: 'Unknown Metric',
        score: 0,
        weight: 0.25,
        status: 'poor' as const,
        description: 'Metric definition not found',
        value: 0,
        unit: '',
      }
    }

    // Calculate score and status based on metric type and value
    const { score, status } = calculateMetricScore(metricId, value)

    return {
      name: metricDef.name,
      score,
      weight: 0.25, // Equal weight for all 4 metrics
      status,
      description: metricDef.description,
      value,
      unit: metricDef.unit === 'currency' ? currency : metricDef.unit,
    }
  })

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600/80'
    if (score >= 60) return 'text-amber-600/80'
    return 'text-red-600/50'
  }

  const getMetricColor = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'text-emerald-600/75'
      case 'fair':
        return 'text-amber-600/75'
      case 'poor':
      case 'critical':
        return 'text-red-600/45'
      default:
        return 'theme-text-secondary'
    }
  }

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'bg-emerald-600/60'
      case 'fair':
        return 'bg-amber-600/60'
      case 'poor':
      case 'critical':
        return 'bg-red-600/35'
      default:
        return 'bg-gray-600/60'
    }
  }

  const getProgressBarBgColor = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'bg-emerald-600/10'
      case 'fair':
        return 'bg-amber-600/10'
      case 'poor':
      case 'critical':
        return 'bg-red-600/6'
      default:
        return 'bg-gray-600/10'
    }
  }

  const overallStatus =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention'

  const formatDisplay = (
    value: number | undefined,
    unit?: string
  ): { prefix?: string; number?: string; suffix?: string; compactSuffix?: string } => {
    if (value === undefined) return {}
    if (unit === currency) {
      const symbol = getCurrencySymbol(currency)
      const formatted = formatCurrency(value, { currency, compact: true })
      const numberOnly = formatted.replace(symbol, '').trim()

      // Check if the number has a compact suffix (K, M, B, etc.)
      const compactMatch = numberOnly.match(/^(.+?)([KMB])$/)
      if (compactMatch) {
        const [, baseNumber, compactSuffix] = compactMatch
        return { prefix: symbol, number: baseNumber, compactSuffix }
      }

      return { prefix: symbol, number: numberOnly }
    }
    if (unit === '%') {
      const rounded = Math.round(value)
      return { number: String(rounded), suffix: '%' }
    }
    if (unit === 'months') {
      const rounded = value.toFixed(1)
      return { number: rounded, suffix: 'm' }
    }
    return { number: String(value) }
  }

  return (
    <Card
      className={cn(
        'kpi-card kpi-card-static kpi-card-dark p-6 group h-full health-score-modern relative',
        className
      )}
    >
      <div className="flex items-center justify-between h-full">
        {/* Left - Score badge */}
        <div className="hs-left flex flex-col items-center justify-center text-center pr-4">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <Heart className={cn('w-5 h-5', getScoreColor(score))} />
            <h3 className="text-xs font-semibold theme-text-secondary tracking-wide">
              Financial Health
            </h3>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="w-4 h-4 p-0 hover:bg-amber-500/10"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <HelpCircle className="w-3 h-3 theme-text-secondary" />
              </Button>
              {showTooltip && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-48 px-3 py-2 rounded shadow-lg z-50 text-xs"
                  style={{
                    backgroundColor: isLightTheme
                      ? 'rgba(255,255,255,0.95)'
                      : 'rgba(30,30,35,0.95)',
                    color: isLightTheme ? '#1f2937' : '#f3f4f6',
                    border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <p
                    className="font-semibold mb-1.5"
                    style={{ color: isLightTheme ? '#1f2937' : '#f3f4f6' }}
                  >
                    Score Calculation
                  </p>
                  <div className="space-y-1">
                    {healthMetrics.map((metric, index) => (
                      <p key={index} style={{ color: isLightTheme ? '#6b7280' : '#9ca3af' }}>
                        • {metric.name} ({Math.round(metric.weight * 100)}%)
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="hs-score flex flex-col items-center">
            {!hasData ? (
              <>
                <span className="inline-block h-12 w-20 relative overflow-hidden rounded">
                  <span className="absolute inset-0 shimmer-bg-30" />
                  <span className="absolute inset-0 shimmer-gradient-medium animate-shimmer-fast" />
                </span>
                <span className="inline-block h-3 w-16 relative overflow-hidden rounded mt-2">
                  <span className="absolute inset-0 shimmer-bg-20" />
                  <span
                    className="absolute inset-0 shimmer-gradient-light animate-shimmer-fast"
                    style={{ animationDelay: '0.1s' }}
                  />
                </span>
              </>
            ) : (
              <>
                <span className={cn('hs-score-value font-black', getScoreColor(score))}>
                  {Math.round(score)}
                </span>
                <span className="hs-score-status text-[11px] theme-text-secondary font-medium mt-1">
                  {overallStatus}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hs-divider h-16 w-px mx-4" />

        {/* Right - Metrics grid */}
        <div className="hs-metrics flex items-center justify-around flex-1 gap-4">
          {!hasData ? (
            // Loading state - show 4 blurred metric placeholders
            <>
              {healthMetrics.map((metric, i) => (
                <div key={metric.name} className="hs-metric text-center min-w-[88px]">
                  <div className="hs-metric-value-row flex items-baseline justify-center gap-1">
                    <span className="inline-block h-6 w-16 relative overflow-hidden rounded">
                      <span className="absolute inset-0 shimmer-bg-30" />
                      <span
                        className="absolute inset-0 shimmer-gradient-medium animate-shimmer-fast"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    </span>
                  </div>
                  <p className="hs-metric-name theme-text-secondary mt-1">{metric.name}</p>
                  <div className="hs-progress-wrap mt-2 w-full">
                    <div className="hs-progress-track" style={{ opacity: 0.2 }}>
                      <div className="hs-progress-fill h-full" style={{ width: 0 }} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            healthMetrics.map((metric) => {
              const parts = formatDisplay(metric.value, metric.unit)
              return (
                <div key={metric.name} className="hs-metric text-center min-w-[88px]">
                  <div className="hs-metric-value-row flex items-baseline justify-center gap-1">
                    {parts?.prefix && (
                      <span className="hs-metric-unit-prefix theme-text-secondary">
                        {parts.prefix}
                      </span>
                    )}
                    <span className={cn('hs-metric-value', getMetricColor(metric.status))}>
                      {parts?.number ?? 'N/A'}
                      {parts?.compactSuffix && (
                        <span className="hs-metric-compact-suffix">{parts.compactSuffix}</span>
                      )}
                    </span>
                    {parts?.suffix && (
                      <span className="hs-metric-unit-suffix theme-text-secondary">
                        {parts.suffix}
                      </span>
                    )}
                  </div>
                  <p className="hs-metric-name theme-text-secondary mt-1">{metric.name}</p>
                  <div className="hs-progress-wrap mt-2 w-full">
                    <div className={cn('hs-progress-track', getProgressBarBgColor(metric.status))}>
                      <div
                        className={cn(
                          'hs-progress-fill transition-all duration-500',
                          getProgressBarColor(metric.status)
                        )}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Card>
  )
}

// Helper functions
function calculateRunwayScore(months: number): number {
  if (months >= 12) return 100
  if (months >= 9) return 85
  if (months >= 6) return 70
  if (months >= 3) return 50
  if (months >= 1) return 30
  return 10
}

function getRunwayStatus(months: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (months >= 12) return 'excellent'
  if (months >= 9) return 'good'
  if (months >= 6) return 'fair'
  if (months >= 3) return 'poor'
  return 'critical'
}

function calculateMarginScore(margin: number): number {
  if (margin >= 70) return 100
  if (margin >= 50) return 85
  if (margin >= 40) return 70
  if (margin >= 25) return 55
  if (margin >= 10) return 40
  return 20
}

function getMarginStatus(margin: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (margin >= 70) return 'excellent'
  if (margin >= 50) return 'good'
  if (margin >= 40) return 'fair'
  if (margin >= 25) return 'poor'
  return 'critical'
}

function calculateCashFlowScore(ocf: number): number {
  if (ocf >= 100000) return 100
  if (ocf >= 50000) return 85
  if (ocf >= 10000) return 70
  if (ocf >= 0) return 55
  if (ocf >= -10000) return 40
  return 20
}

function getCashFlowStatus(ocf: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (ocf >= 100000) return 'excellent'
  if (ocf >= 50000) return 'good'
  if (ocf >= 10000) return 'fair'
  if (ocf >= 0) return 'poor'
  return 'critical'
}

function calculateCashBalanceScore(balance: number): number {
  if (balance >= 500000) return 100
  if (balance >= 250000) return 85
  if (balance >= 100000) return 70
  if (balance >= 50000) return 55
  if (balance >= 10000) return 40
  return 20
}

function getCashBalanceStatus(
  balance: number
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (balance >= 500000) return 'excellent'
  if (balance >= 250000) return 'good'
  if (balance >= 100000) return 'fair'
  if (balance >= 50000) return 'poor'
  return 'critical'
}
