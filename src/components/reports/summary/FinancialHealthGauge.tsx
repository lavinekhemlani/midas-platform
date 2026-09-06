'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface HealthComponent {
  name: string
  score: number
  weight: number
}

interface ProfitMetric {
  current: number
  previous?: number
  changePercent?: number
  margin?: number
}

interface FinancialHealthGaugeProps {
  score: number
  rating: string
  components: HealthComponent[]
  profitMetric?: ProfitMetric
  currency?: string
  className?: string
}

export default function FinancialHealthGauge({
  score,
  rating,
  components,
  profitMetric,
  currency = 'USD',
  className,
}: FinancialHealthGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [showComponents, setShowComponents] = useState(false)

  useEffect(() => {
    // Animate score on mount
    const timer = setTimeout(() => {
      setAnimatedScore(score)
      setTimeout(() => setShowComponents(true), 800)
    }, 200)
    return () => clearTimeout(timer)
  }, [score])

  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-emerald-400'
    if (value >= 60) return 'text-blue-400'
    if (value >= 40) return 'text-yellow-400'
    return 'text-theme-red'
  }

  const getScoreColorClass = (value: number) => {
    if (value >= 80) return 'emerald-500'
    if (value >= 60) return 'blue-500'
    if (value >= 40) return 'yellow-500'
    return 'theme-red'
  }

  const getScoreGradient = (value: number) => {
    if (value >= 80) return 'from-emerald-400/20 to-emerald-600/20'
    if (value >= 60) return 'from-blue-400/20 to-blue-600/20'
    if (value >= 40) return 'from-yellow-400/20 to-yellow-600/20'
    return 'from-theme-red/20 to-theme-red/20'
  }

  const getRatingIcon = () => {
    if (score >= 80) return <CheckCircle className="w-5 h-5 text-emerald-400" />
    if (score >= 60) return <TrendingUp className="w-5 h-5 text-blue-400" />
    if (score >= 40) return <Activity className="w-5 h-5 text-yellow-400" />
    return <AlertTriangle className="w-5 h-5 text-theme-red" />
  }

  // Circle configuration
  const size = 160
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference

  return (
    <Card className={cn('glass-luxury-card relative overflow-hidden gap-0', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {getRatingIcon()}
            Financial Health Score
          </span>
          <span className={cn('text-lg font-bold', getScoreColor(score))}>{rating}</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center">
          {/* Circular Gauge */}
          <div className="relative mb-4" style={{ width: size, height: size }}>
            {/* Pulsating background circle - perfectly aligned */}
            <div
              className={cn(
                'absolute top-0 left-0 rounded-full animate-pulse transition-all duration-1000',
                `bg-gradient-to-br ${getScoreGradient(animatedScore)}`
              )}
              style={{
                width: size,
                height: size,
                opacity: 0.3,
              }}
            />

            {/* SVG Progress Circle */}
            <svg width={size} height={size} className="absolute top-0 left-0 transform -rotate-90">
              {/* Background track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="rgb(55 65 81 / 0.2)"
                strokeWidth={strokeWidth}
              />

              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  'transition-all duration-1000 ease-out',
                  `text-${getScoreColorClass(animatedScore)}`
                )}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  'text-3xl font-bold transition-all duration-1000 tabular-nums',
                  getScoreColor(animatedScore)
                )}
              >
                {Math.round(animatedScore)}
              </span>
              <span className="text-xs theme-text-secondary mt-1">Health Score</span>
            </div>
          </div>

          {/* Component Scores */}
          <div
            className={cn(
              'grid grid-cols-2 gap-3 w-full transition-all duration-700',
              showComponents ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
          >
            {components.map((component, index) => (
              <div
                key={component.name}
                className="glass-luxury-card p-3 hover:scale-[1.02] transition-all duration-300"
                style={{
                  transitionDelay: showComponents ? `${index * 100}ms` : '0ms',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs theme-text-secondary capitalize">{component.name}</span>
                  <span
                    className={cn('text-sm font-bold tabular-nums', getScoreColor(component.score))}
                  >
                    {Math.round(component.score)}
                  </span>
                </div>

                {/* Mini progress bar */}
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-700 ease-out',
                      `bg-${getScoreColorClass(component.score)}`
                    )}
                    style={{
                      width: showComponents ? `${component.score}%` : '0%',
                      transitionDelay: showComponents ? `${index * 100 + 300}ms` : '0ms',
                    }}
                  />
                </div>

                {/* Weight indicator */}
                <div className="mt-1 text-xs theme-text-secondary opacity-70">
                  Weight: {Math.round(component.weight * 100)}%
                </div>
              </div>
            ))}
          </div>

          {/* Score Interpretation */}
          <div className="mt-6 p-4 glass-luxury-card w-full">
            <div className="flex items-center gap-3 mb-2">
              {getRatingIcon()}
              <span className="font-medium theme-text-primary">{rating} Financial Health</span>
            </div>
            <p className="text-xs theme-text-secondary leading-relaxed">
              {score >= 80 &&
                'Excellent financial health. Continue current strategies and explore growth opportunities.'}
              {score >= 60 &&
                score < 80 &&
                'Good financial health. Focus on optimizing weak areas for better performance.'}
              {score >= 40 &&
                score < 60 &&
                'Fair financial health. Review and improve liquidity and profitability metrics.'}
              {score < 40 &&
                'Needs immediate attention. Consider restructuring operations and reducing costs.'}
            </p>
          </div>

          {/* Profit Summary Stats at Bottom */}
          {profitMetric && (
            <div className="mt-4 p-4 bg-blue-500/10 rounded-lg w-full border border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium theme-text-primary">Net Profit</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-400">
                    {formatCompactCurrency(profitMetric.current, currency)}
                  </div>
                  {profitMetric.changePercent !== undefined && (
                    <div className="text-xs theme-text-secondary flex items-center gap-1 justify-end">
                      {profitMetric.changePercent > 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-theme-red" />
                      )}
                      <span
                        className={
                          profitMetric.changePercent > 0 ? 'text-emerald-400' : 'text-theme-red'
                        }
                      >
                        {Math.abs(profitMetric.changePercent).toFixed(1)}%
                      </span>
                      <span>vs prev period</span>
                    </div>
                  )}
                  {profitMetric.margin && (
                    <div className="text-xs theme-text-secondary mt-1">
                      Margin: {profitMetric.margin.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
