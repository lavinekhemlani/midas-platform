// src/components/quickbooks/shared/MetricCard.tsx
'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, HelpCircle, BookOpen } from 'lucide-react'
import { MetricCardProps } from './types'
import { BaseCard } from './BaseCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LearnSheetContent } from '@/components/learn/core/LearnSheetContent'

export function MetricCard({
  title,
  value,
  previousValue,
  trend,
  icon: Icon,
  iconColor = 'text-amber-500',
  format = 'text',
  currency = 'USD',
  decimals = 0,
  className,
  tooltip,
  description,
  learnTerm,
  ...props
}: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showLearnTooltip, setShowLearnTooltip] = useState(false)
  const [isLearnModalOpen, setIsLearnModalOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const startCloseAnimation = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsLearnModalOpen(false)
      setIsClosing(false)
    }, 400)
  }
  // Format the value based on type
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val)

      case 'percentage':
        return `${val.toFixed(decimals)}%`

      case 'number':
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(val)

      default:
        return val.toString()
    }
  }

  // Get trend icon
  const TrendIcon =
    trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus

  const trendColor =
    trend?.direction === 'up'
      ? 'text-emerald-400'
      : trend?.direction === 'down'
        ? 'text-red-400'
        : 'text-gray-400'

  return (
    <Dialog open={isLearnModalOpen} onOpenChange={setIsLearnModalOpen}>
      <BaseCard className={cn('h-full group', className)} noPadding {...props}>
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              {Icon && <Icon className={cn('w-5 h-5', iconColor)} strokeWidth={1.5} />}
              <h3 className="text-base font-semibold theme-text-primary">{title}</h3>
            </div>
            <div className="flex items-center space-x-1">
              {learnTerm && (
                <div
                  className="relative"
                  onMouseEnter={() => setShowLearnTooltip(true)}
                  onMouseLeave={() => setShowLearnTooltip(false)}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    >
                      <BookOpen className="w-4 h-4 text-amber-500 icon-shimmer transition-all" />
                    </Button>
                  </DialogTrigger>
                  {showLearnTooltip && (
                    <div className="absolute bottom-full right-0 mb-2 w-auto px-2 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg z-10 whitespace-nowrap">
                      Learn
                    </div>
                  )}
                </div>
              )}
              {(tooltip || description) && (
                <div
                  className="relative"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  >
                    <HelpCircle className="w-4 h-4 theme-text-secondary" />
                  </Button>
                  {showTooltip && (
                    <div
                      className="absolute bottom-full right-0 mb-2 w-64 p-3 kpi-tooltip text-xs rounded-lg shadow-xl border"
                      style={{ zIndex: 50 }}
                    >
                      {description && (
                        <div className="font-semibold theme-text-primary mb-1">{description}</div>
                      )}
                      {tooltip && (
                        <div className="theme-text-secondary leading-relaxed">{tooltip}</div>
                      )}
                      <div className="absolute top-full right-3 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-current opacity-90"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center mb-3">
            <div className="text-3xl font-black theme-text-primary">{formatValue(value)}</div>
          </div>

          {trend && (
            <div className="flex items-center justify-between">
              <div className={cn('flex items-center space-x-2 text-sm', trendColor)}>
                <TrendIcon className="w-4 h-4" strokeWidth={1.5} />
                {trend.percentage !== undefined && (
                  <span className="font-medium">{trend.percentage.toFixed(1)}%</span>
                )}
              </div>
              {previousValue !== undefined && (
                <span className="text-xs theme-text-secondary">
                  vs {formatValue(previousValue)}
                </span>
              )}
            </div>
          )}
        </div>
      </BaseCard>
      {learnTerm && (
        <DialogContent
          className={cn(
            'glass-sheet w-full sm:w-[540px] sm:max-w-none p-0 border-slate-200/20 dark:border-slate-800/40 bg-gradient-to-br from-slate-500/5 to-transparent shadow-2xl',
            isClosing && 'animate-dialog-out-southeast'
          )}
        >
          <DialogHeader className="p-0 h-0 overflow-hidden">
            <DialogTitle className="sr-only">Learn: {title}</DialogTitle>
          </DialogHeader>
          <LearnSheetContent
            termId={learnTerm}
            icon={Icon}
            iconColor={iconColor}
            onClose={() => setIsLearnModalOpen(false)}
            startCloseAnimation={startCloseAnimation}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}
