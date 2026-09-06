import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronRight, LucideIcon, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPnLCurrency, formatPercentage } from '@/lib/utils/currency'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface MetricPreview {
  label: string
  value: number | string
  format?: 'currency' | 'percentage' | 'custom'
  trend?: number
  previousValue?: number
  icon?: LucideIcon
  color?: string
}

interface ReportNavigationCardProps {
  title: string
  description: string
  href?: string
  icon: LucideIcon
  iconColor: string
  metrics: MetricPreview[]
  lastUpdated?: string
  isLoading?: boolean
  currency?: string
  error?: any
  onRetry?: () => void
}

export function ReportNavigationCard({
  title,
  description,
  href,
  icon: Icon,
  iconColor,
  metrics,
  lastUpdated,
  isLoading = false,
  currency = 'USD',
  error,
  onRetry,
}: ReportNavigationCardProps) {
  const formatValue = (value: number | string, format?: 'currency' | 'percentage' | 'custom') => {
    if (typeof value === 'string') return value

    switch (format) {
      case 'currency':
        return formatPnLCurrency(value, currency)
      case 'percentage':
        return formatPercentage(value, 1)
      default:
        return value.toLocaleString()
    }
  }

  const headerContent = (
    <div className="flex items-center gap-1.5 relative">
      <div
        className={cn(
          'p-1.5 rounded-lg transition-all',
          iconColor,
          href && 'group-hover:scale-110'
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <CardTitle
          className={cn(
            'text-base font-bold theme-text-primary transition-colors',
            href && 'group-hover:text-amber-400'
          )}
        >
          {title}
        </CardTitle>
      </div>
      {href && (
        <ChevronRight
          className={cn(
            'w-4 h-4 theme-text-secondary transition-all duration-200',
            'group-hover:text-amber-400 group-hover:scale-125'
          )}
        />
      )}
    </div>
  )

  const cardContent = (
    <Card
      className={cn(
        'glass-luxury-card transition-all duration-300 h-full flex flex-col gap-0',
        'border border-gray-200/10',
        href && 'cursor-pointer'
      )}
    >
      <CardHeader className="px-3 pb-3">{headerContent}</CardHeader>

      <CardContent className="px-3 pb-0 flex-1">
        {error ? (
          // Error state with retry button
          <div className="flex flex-col items-center justify-center py-3 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
            <p className="text-xs text-red-400 mb-1">
              {error.status === 429 ? 'Rate limited' : 'Failed to load'}
            </p>
            <p className="text-[10px] theme-text-secondary mb-2">
              {error.status === 429 ? 'Too many requests. Please wait.' : 'Unable to fetch data'}
            </p>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRetry()
                }}
                className="h-7 px-2 text-xs gap-1 hover:bg-gray-700/50"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {metrics.map((metric, index) => {
              const MetricIcon = metric.icon
              return (
                <div
                  key={index}
                  className="flex items-center justify-between py-1 border-b border-gray-200/5 last:border-0"
                >
                  <div className="flex items-center gap-1.5">
                    {MetricIcon && (
                      <div className={cn(metric.color || 'theme-text-secondary')}>
                        <MetricIcon className="w-4 h-4" />
                      </div>
                    )}
                    <p className="text-xs theme-text-secondary">{metric.label}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    {isLoading ? (
                      <span className="inline-block w-20 h-5 bg-gray-700/30 animate-pulse" />
                    ) : (
                      <>
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            metric.color || 'theme-text-primary'
                          )}
                        >
                          {formatValue(metric.value, metric.format)}
                        </p>
                        {metric.trend !== undefined && (
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 cursor-help">
                                  <span
                                    className={cn(
                                      'text-[10px] font-medium',
                                      metric.trend >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    )}
                                  >
                                    {metric.trend >= 0 ? '↗' : '↘'}{' '}
                                    {Math.abs(metric.trend).toFixed(1)}%
                                  </span>
                                  <span className="text-[9px] theme-text-secondary">YoY</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-xs">Year-over-Year Comparison</p>
                                  <div className="text-xs space-y-0.5">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-gray-400">Current:</span>
                                      <span className="font-mono">
                                        {formatValue(metric.value, metric.format)}
                                      </span>
                                    </div>
                                    {metric.previousValue !== undefined && (
                                      <>
                                        <div className="flex justify-between gap-4">
                                          <span className="text-gray-400">Previous Year:</span>
                                          <span className="font-mono">
                                            {formatValue(metric.previousValue, metric.format)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-4 pt-1 border-t border-gray-600">
                                          <span className="text-gray-400">Growth:</span>
                                          <span
                                            className={cn(
                                              'font-semibold',
                                              metric.trend >= 0
                                                ? 'text-emerald-400'
                                                : 'text-red-400'
                                            )}
                                          >
                                            {metric.trend.toFixed(1)}%
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return href ? (
    <Link
      href={href}
      className={cn('block group transition-transform duration-200 h-full', 'hover:scale-[1.02]')}
    >
      {cardContent}
    </Link>
  ) : (
    cardContent
  )
}
