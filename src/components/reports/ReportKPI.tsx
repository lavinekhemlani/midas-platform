'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, LucideIcon, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

interface CalculationComponent {
  label: string
  value: string | number
  highlight?: boolean
}

interface CalculationTooltip {
  formula: string
  components?: CalculationComponent[]
}

interface ReportKPIProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  format?: 'currency' | 'percentage' | 'number' | 'custom'
  trend?: 'up' | 'down' | 'neutral'
  tooltip?: string
  calculationTooltip?: CalculationTooltip
  className?: string
  size?: 'sm' | 'md' | 'lg'
  fullHeight?: boolean
  currency?: string
}

export function ReportKPI({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  format = 'custom',
  trend,
  tooltip,
  calculationTooltip,
  className,
  size = 'md',
  fullHeight = false,
  currency = 'USD',
}: ReportKPIProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(val)
      case 'percentage':
        return `${val}%`
      case 'number':
        return new Intl.NumberFormat('en-US').format(val)
      default:
        return val.toString()
    }
  }

  const getTrendIcon = () => {
    if (trend === 'up' || (change && change > 0)) {
      return <TrendingUp className="w-4 h-4" />
    } else if (trend === 'down' || (change && change < 0)) {
      return <TrendingDown className="w-4 h-4" />
    }
    return <Minus className="w-4 h-4" />
  }

  const getTrendColor = () => {
    if (trend === 'up' || (change && change > 0)) {
      return 'text-emerald-500'
    } else if (trend === 'down' || (change && change < 0)) {
      return 'text-red-500'
    }
    return 'text-gray-500'
  }

  const sizeClasses = {
    sm: {
      container: 'p-3',
      label: 'text-xs',
      value: 'text-xl',
      change: 'text-xs',
    },
    md: {
      container: 'p-4',
      label: 'text-sm',
      value: 'text-3xl',
      change: 'text-sm',
    },
    lg: {
      container: 'p-6',
      label: 'text-base',
      value: 'text-4xl',
      change: 'text-base',
    },
  }

  return (
    <div
      className={cn(
        'glass-luxury-card relative overflow-hidden',
        fullHeight ? 'h-full flex flex-col justify-between' : sizeClasses[size].container,
        fullHeight ? 'p-4' : '',
        className
      )}
    >
      {/* Background Circle Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="absolute bottom-0 right-0 w-32 h-32" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </svg>
      </div>

      <div className="relative flex items-start justify-between mb-2">
        <span className={cn('text-muted-foreground font-medium', sizeClasses[size].label)}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          {/* Show original icon if no calculation tooltip, or if both exist show icon normally */}
          {Icon &&
            !calculationTooltip &&
            (tooltip ? (
              <div className="kpi-tooltip-container">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      align="center"
                      sideOffset={8}
                      className="kpi-tooltip"
                    >
                      <p>{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <Icon className="w-4 h-4 text-muted-foreground" />
            ))}

          {/* Show Icon alongside HelpCircle if both exist */}
          {Icon && calculationTooltip && <Icon className="w-4 h-4 text-muted-foreground" />}

          {/* Calculation tooltip with HelpCircle icon */}
          {calculationTooltip && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-amber-500/10">
                    <HelpCircle className="w-4 h-4 theme-text-secondary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  align="start"
                  sideOffset={12}
                  className="w-72 p-3 kpi-tooltip text-xs rounded-lg shadow-xl border max-w-none z-[100]"
                >
                  <div className="font-semibold theme-text-primary mb-1">How it's calculated</div>
                  <div className="theme-text-secondary leading-relaxed space-y-2">
                    <div className="border-t border-gray-700 pt-2">
                      <span className="font-semibold text-amber-500">Formula:</span>{' '}
                      <span className="font-mono">{calculationTooltip.formula}</span>
                    </div>

                    {/* Components breakdown */}
                    {calculationTooltip.components && calculationTooltip.components.length > 0 && (
                      <div className="border-t border-gray-700 pt-2">
                        <div className="space-y-1">
                          {calculationTooltip.components.map((component, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'flex justify-between',
                                component.highlight
                                  ? 'font-semibold text-cyan-400 pt-1 border-t border-gray-700'
                                  : ''
                              )}
                            >
                              <span className={component.highlight ? '' : 'theme-text-secondary'}>
                                {component.label}:
                              </span>
                              <span
                                className={cn(
                                  'font-mono',
                                  component.highlight ? 'text-cyan-400' : 'theme-text-primary'
                                )}
                              >
                                {component.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className={cn('relative font-normal theme-text-primary', sizeClasses[size].value)}>
        {formatValue(value)}
      </div>

      {(change !== undefined || changeLabel) && (
        <div
          className={cn('flex items-center gap-1 mt-2', sizeClasses[size].change, getTrendColor())}
        >
          {getTrendIcon()}
          <span>
            {change !== undefined && `${change}%`}
            {changeLabel && ` ${changeLabel}`}
          </span>
        </div>
      )}
    </div>
  )
}

interface ReportKPIGroupProps {
  kpis: ReportKPIProps[]
  columns?: 2 | 3 | 4 | 6
  className?: string
}

export function ReportKPIGroup({ kpis, columns = 3, className }: ReportKPIGroupProps) {
  const columnClasses = {
    2: 'grid-cols-1 @md:grid-cols-2',
    3: 'grid-cols-1 @md:grid-cols-3',
    4: 'grid-cols-1 @md:grid-cols-2 @lg:grid-cols-4',
    6: 'grid-cols-2 @md:grid-cols-3 @lg:grid-cols-6',
  }

  return (
    <div className={cn('grid gap-4', columnClasses[columns], className)}>
      {kpis.map((kpi, index) => (
        <ReportKPI key={index} {...kpi} />
      ))}
    </div>
  )
}
