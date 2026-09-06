// src/app/(main)/components/EfficiencyMetrics.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Clock,
  CreditCard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Users,
  Zap,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'

interface EfficiencyMetric {
  label: string
  value: number
  unit: 'days' | 'percentage' | 'currency' | 'ratio'
  trend?: {
    direction: 'up' | 'down' | 'stable'
    percentage: number
  }
  target?: number
  description: string
  tooltip?: string
  icon: React.ComponentType<{ className?: string }>
  status: 'good' | 'warning' | 'critical'
}

interface EfficiencyMetricsProps {
  metrics: EfficiencyMetric[]
  currency?: string
  className?: string
}

export default function EfficiencyMetrics({
  metrics,
  currency = 'USD',
  className,
}: EfficiencyMetricsProps) {
  const formatMetricValue = (value: number, unit: string) => {
    switch (unit) {
      case 'days':
        return `${Math.round(value)}d`
      case 'percentage':
        return `${value.toFixed(1)}%`
      case 'currency':
        return formatCurrency(value, { currency, compact: true })
      case 'ratio':
        return value.toFixed(2)
      default:
        return value.toString()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-emerald-400'
      case 'warning':
        return 'text-amber-400'
      case 'critical':
        return 'text-red-400'
      default:
        return 'theme-text-secondary'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-emerald-500/10 border-emerald-500/30'
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30'
      case 'critical':
        return 'bg-red-500/10 border-red-500/30'
      default:
        return 'bg-slate-500/10 border-slate-500/30'
    }
  }

  // Default metrics if none provided
  const defaultMetrics: EfficiencyMetric[] = [
    {
      label: 'Days Sales Outstanding',
      value: 30,
      unit: 'days',
      trend: { direction: 'down', percentage: -5.2 },
      target: 25,
      description: 'Average days to collect payment',
      icon: Clock,
      status: 'warning',
    },
    {
      label: 'Days Payable Outstanding',
      value: 45,
      unit: 'days',
      trend: { direction: 'up', percentage: 8.3 },
      target: 40,
      description: 'Average days to pay suppliers',
      icon: CreditCard,
      status: 'good',
    },
    {
      label: 'Operating Efficiency',
      value: 78.5,
      unit: 'percentage',
      trend: { direction: 'up', percentage: 3.1 },
      target: 85,
      description: 'Revenue per operating expense',
      icon: Activity,
      status: 'good',
    },
    {
      label: 'Customer Acquisition Cost',
      value: 1250,
      unit: 'currency',
      trend: { direction: 'down', percentage: -12.4 },
      target: 1000,
      description: 'Cost to acquire new customer',
      icon: Users,
      status: 'warning',
    },
  ]

  const displayMetrics = metrics.length > 0 ? metrics : defaultMetrics

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
      {displayMetrics.map((metric, index) => {
        const Icon = metric.icon
        const TrendIcon =
          metric.trend?.direction === 'up'
            ? TrendingUp
            : metric.trend?.direction === 'down'
              ? TrendingDown
              : null

        const progress = metric.target
          ? metric.unit === 'days'
            ? Math.max(0, Math.min(100, (metric.target / metric.value) * 100))
            : Math.max(0, Math.min(100, (metric.value / metric.target) * 100))
          : 0

        return (
          <Card key={index} className="glass-luxury-card hover:shadow-lg transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      getStatusBg(metric.status)
                    )}
                  >
                    <Icon className={cn('w-5 h-5', getStatusColor(metric.status))} />
                  </div>
                </div>
                <Badge variant="outline" className={cn('text-xs', getStatusBg(metric.status))}>
                  {metric.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium theme-text-secondary mb-1 flex items-center gap-1">
                    {metric.label}
                    {metric.tooltip && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{metric.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </h3>
                  <div className={cn('text-2xl font-bold', getStatusColor(metric.status))}>
                    {formatMetricValue(metric.value, metric.unit)}
                  </div>
                </div>

                {metric.trend && (
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        'flex items-center space-x-1 text-sm',
                        metric.trend.direction === 'up'
                          ? 'text-emerald-400'
                          : metric.trend.direction === 'down'
                            ? 'text-red-400'
                            : 'theme-text-secondary'
                      )}
                    >
                      {TrendIcon && <TrendIcon className="w-3 h-3" />}
                      <span>{metric.trend.percentage}%</span>
                    </div>
                    <span className="text-xs theme-text-secondary">vs last period</span>
                  </div>
                )}

                {metric.target && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="theme-text-secondary">
                        Target: {formatMetricValue(metric.target, metric.unit)}
                      </span>
                      <span className="theme-text-secondary">{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                )}

                <p className="text-xs theme-text-secondary line-clamp-2">{metric.description}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
