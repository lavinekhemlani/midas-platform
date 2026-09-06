// src/app/(main)/components/report/AnalysisText.tsx
'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, AlertCircle, Info } from 'lucide-react'
import React from 'react'

interface AnalysisTextProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'muted' | 'emphasis' | 'highlight' | 'positive' | 'negative' | 'warning'
  size?: 'sm' | 'base' | 'lg'
  icon?: boolean
  animate?: boolean
}

export function AnalysisText({ 
  children, 
  className,
  variant = 'default',
  size = 'base',
  icon = false,
  animate = true
}: AnalysisTextProps) {
  const getIcon = () => {
    if (!icon) return null
    
    switch (variant) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      case 'highlight':
        return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
      default:
        return null
    }
  }

  const variantClasses = {
    default: 'theme-text-primary',
    muted: 'theme-text-secondary',
    emphasis: 'theme-text-primary font-semibold',
    highlight: 'theme-text-primary bg-blue-500/5 border-l-4 border-blue-500/50',
    positive: 'theme-text-primary bg-emerald-500/5 border-l-4 border-emerald-500/50',
    negative: 'theme-text-primary bg-red-500/5 border-l-4 border-red-500/50',
    warning: 'theme-text-primary bg-amber-500/5 border-l-4 border-amber-500/50'
  }

  const sizeClasses = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-7',
    lg: 'text-lg leading-8'
  }

  const needsPadding = ['highlight', 'positive', 'negative', 'warning'].includes(variant)
  const IconComponent = getIcon()

  return (
    <div 
      className={cn(
        "analysis-text transition-all duration-300",
        sizeClasses[size],
        variantClasses[variant],
        needsPadding && "px-4 py-3 rounded-r-lg",
        animate && "animate-fade-in",
        className
      )}
    >
      {IconComponent ? (
        <div className="flex items-start gap-3">
          {IconComponent}
          <div className="flex-1">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// Additional helper component for structured analysis
interface AnalysisPointsProps {
  points: Array<{
    label: string
    value: string | number
    trend?: 'up' | 'down' | 'stable'
    highlight?: boolean
  }>
  className?: string
}

export function AnalysisPoints({ points, className }: AnalysisPointsProps) {
  return (
    <div className={cn("analysis-points space-y-2", className)}>
      {points.map((point, index) => (
        <div 
          key={index}
          className={cn(
            "flex items-center justify-between py-2 px-3 rounded-lg",
            "transition-all duration-300",
            point.highlight ? "bg-amber-500/10 border border-amber-500/20" : "bg-slate-500/5"
          )}
        >
          <span className="text-sm theme-text-secondary">{point.label}</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-semibold",
              point.highlight ? "text-amber-400" : "theme-text-primary"
            )}>
              {point.value}
            </span>
            {point.trend && (
              <span className={cn(
                "text-xs",
                point.trend === 'up' ? "text-emerald-400" : 
                point.trend === 'down' ? "text-red-400" : 
                "theme-text-secondary"
              )}>
                {point.trend === 'up' ? '↑' : point.trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}