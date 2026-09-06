// src/app/(main)/components/report/QuotedInsight.tsx
'use client'

import { Quote, Sparkles, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuotedInsightProps {
  children: React.ReactNode
  author?: string
  type?: 'insight' | 'recommendation' | 'warning' | 'opportunity'
  confidence?: number
  timestamp?: Date
  className?: string
}

export function QuotedInsight({ 
  children, 
  author = 'Midas AI CFO',
  type = 'insight',
  confidence,
  timestamp,
  className 
}: QuotedInsightProps) {
  const getTypeConfig = () => {
    switch (type) {
      case 'recommendation':
        return {
          icon: Lightbulb,
          borderColor: 'border-blue-500/50',
          bgColor: 'bg-blue-500/5',
          hoverBg: 'hover:bg-blue-500/10',
          iconColor: 'text-blue-500/60',
          quoteColor: 'text-blue-500/30'
        }
      case 'warning':
        return {
          icon: AlertCircle,
          borderColor: 'border-red-500/50',
          bgColor: 'bg-red-500/5',
          hoverBg: 'hover:bg-red-500/10',
          iconColor: 'text-red-500/60',
          quoteColor: 'text-red-500/30'
        }
      case 'opportunity':
        return {
          icon: TrendingUp,
          borderColor: 'border-emerald-500/50',
          bgColor: 'bg-emerald-500/5',
          hoverBg: 'hover:bg-emerald-500/10',
          iconColor: 'text-emerald-500/60',
          quoteColor: 'text-emerald-500/30'
        }
      default:
        return {
          icon: Sparkles,
          borderColor: 'border-amber-500/50',
          bgColor: 'bg-amber-500/5',
          hoverBg: 'hover:bg-amber-500/10',
          iconColor: 'text-amber-500/60',
          quoteColor: 'text-amber-500/30'
        }
    }
  }

  const config = getTypeConfig()
  const Icon = config.icon

  return (
    <div className={cn(
      "quoted-insight relative py-4 px-6 my-6",
      "border-l-4 rounded-r-lg",
      "transition-all duration-300",
      "animate-fade-in-left",
      config.borderColor,
      config.bgColor,
      config.hoverBg,
      className
    )}>
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <Quote className={cn("w-4 h-4", config.quoteColor)} />
        <Icon className={cn("w-4 h-4", config.iconColor)} />
      </div>
      
      <blockquote className="italic theme-text-primary pl-8 pr-4 text-sm md:text-base leading-relaxed">
        {children}
      </blockquote>
      
      <div className="flex items-center justify-between mt-4 pl-8">
        <div className="flex items-center gap-3">
          <span className="text-xs theme-text-secondary">— {author}</span>
          {confidence && (
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-slate-500/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-xs theme-text-secondary ml-1">{confidence}%</span>
            </div>
          )}
        </div>
        {timestamp && (
          <time className="text-xs theme-text-secondary">
            {timestamp.toLocaleString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              month: 'short',
              day: 'numeric'
            })}
          </time>
        )}
      </div>
    </div>
  )
}