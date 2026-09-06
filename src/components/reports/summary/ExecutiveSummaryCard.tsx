'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

interface MetricData {
  current: number
  previous: number
  change: number
  changePercent: number
  yoyChange?: number
  target?: number
  targetProgress?: number
  margin?: number
  ratio?: number
}

interface ExecutiveSummaryCardProps {
  title: string
  metric: MetricData
  type: 'revenue' | 'profit' | 'expenses' | 'cashFlow'
  currency?: string
  showTarget?: boolean
  showMargin?: boolean
  icon?: React.ReactNode
  className?: string
}

export default function ExecutiveSummaryCard({
  title,
  metric,
  type,
  currency = 'USD',
  showTarget = false,
  showMargin = false,
  icon,
  className,
}: ExecutiveSummaryCardProps) {
  const getTypeColor = () => {
    switch (type) {
      case 'revenue':
        return 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20'
      case 'profit':
        return 'from-blue-500/10 to-blue-600/10 border-blue-500/20'
      case 'expenses':
        return 'from-orange-500/10 to-orange-600/10 border-orange-500/20'
      case 'cashFlow':
        return 'from-purple-500/10 to-purple-600/10 border-purple-500/20'
      default:
        return 'from-gray-500/10 to-gray-600/10 border-gray-500/20'
    }
  }

  const getValueColor = () => {
    switch (type) {
      case 'revenue':
        return 'text-emerald-400'
      case 'profit':
        return 'text-blue-400'
      case 'expenses':
        return 'text-orange-400'
      case 'cashFlow':
        return 'text-purple-400'
      default:
        return 'text-gray-400'
    }
  }

  const getTrendIcon = () => {
    if (type === 'expenses') {
      // For expenses, negative change is good
      if (metric.changePercent < -1) return <TrendingDown className="w-4 h-4 text-emerald-400" />
      if (metric.changePercent > 1) return <TrendingUp className="w-4 h-4 text-red-400" />
    } else {
      // For revenue, profit, cashFlow, positive change is good
      if (metric.changePercent > 1) return <TrendingUp className="w-4 h-4 text-emerald-400" />
      if (metric.changePercent < -1) return <TrendingDown className="w-4 h-4 text-red-400" />
    }
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getChangeColor = () => {
    if (type === 'expenses') {
      return metric.changePercent < 0 ? 'text-emerald-400' : 'text-red-400'
    }
    return metric.changePercent > 0 ? 'text-emerald-400' : 'text-red-400'
  }

  return (
    <Card
      className={cn(
        'glass-luxury-card relative overflow-hidden transition-all duration-300 hover:scale-[1.02] gap-0',
        `bg-gradient-to-br ${getTypeColor()}`,
        className
      )}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        <svg className="absolute bottom-0 right-0 w-32 h-32" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>

      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium theme-text-secondary flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {getTrendIcon()}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3">
        {/* Main Value */}
        <div className="flex items-baseline justify-between">
          <span className={cn('text-2xl', getValueColor())}>
            {formatCompactCurrency(metric.current, currency)}
          </span>
          {metric.yoyChange !== undefined && (
            <span className="text-xs theme-text-secondary">
              YoY: {metric.yoyChange.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Change Indicator */}
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium flex items-center gap-1', getChangeColor())}>
            {metric.changePercent > 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(metric.changePercent).toFixed(1)}%
          </span>
          <span className="text-xs theme-text-secondary">
            vs {formatCompactCurrency(metric.previous, currency)} last period
          </span>
        </div>

        {/* Additional Metrics */}
        {showMargin && metric.margin !== undefined && (
          <div className="pt-2 border-t border-gray-700/30">
            <div className="flex items-center justify-between">
              <span className="text-xs theme-text-secondary">Margin</span>
              <span className="text-xs font-medium theme-text-primary">
                {metric.margin.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {showTarget && metric.target !== undefined && metric.targetProgress !== undefined && (
          <div className="pt-2 border-t border-gray-700/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs theme-text-secondary">Target</span>
              <span className="text-xs font-medium theme-text-primary">
                {formatCompactCurrency(metric.target, currency)}
              </span>
            </div>
            <div className="w-full bg-gray-700/30 rounded-full h-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-500',
                  metric.targetProgress >= 100
                    ? 'bg-emerald-500'
                    : metric.targetProgress >= 75
                      ? 'bg-blue-500'
                      : metric.targetProgress >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                )}
                style={{ width: `${Math.min(100, metric.targetProgress)}%` }}
              />
            </div>
            <span className="text-xs theme-text-secondary mt-1">
              {metric.targetProgress.toFixed(0)}% of target
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
