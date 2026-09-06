// src/app/(main)/components/InsightsPanel.tsx
'use client'

import { useState } from 'react'
import { 
  TrendingUp, 
  AlertTriangle, 
  Info, 
  Lightbulb,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

type InsightType = 'positive' | 'warning' | 'critical' | 'neutral'
type InsightPriority = 'high' | 'medium' | 'low'
type InsightCategory = 'cash-flow' | 'revenue' | 'expenses' | 'growth' | 'risk' | 'opportunity'

export interface Insight {
  id: string
  type: InsightType
  title: string
  description: string
  recommendation?: string
  priority?: InsightPriority
  category?: InsightCategory
  actionable?: boolean
}

interface InsightsPanelProps {
  insights: Insight[]
  className?: string
  maxVisible?: number
  showCategories?: boolean
  onDismiss?: (id: string) => void
  defaultOpen?: boolean
}

export default function InsightsPanel({ 
  insights, 
  className, 
  maxVisible = 3,
  showCategories = false,
  onDismiss,
  defaultOpen = true
}: InsightsPanelProps) {
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(defaultOpen)

  const activeInsights = insights.filter(insight => !dismissedInsights.has(insight.id))
  const visibleInsights = showAll ? activeInsights : []

  const handleDismiss = (id: string) => {
    setDismissedInsights(prev => new Set(prev).add(id))
    onDismiss?.(id)
  }

  const getTypeStyles = (type: InsightType) => {
    switch (type) {
      case 'positive':
        return 'border-emerald-500/20 bg-emerald-500/5'
      case 'warning':
        return 'border-amber-500/20 bg-amber-500/5'
      case 'critical':
        return 'border-red-500/20 bg-red-500/5'
      default:
        return 'border-blue-500/20 bg-blue-500/5'
    }
  }

  const getTypeIcon = (type: InsightType, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
    switch (type) {
      case 'positive':
        return <CheckCircle className={cn(sizeClass, "text-emerald-500")} />
      case 'warning':
        return <AlertTriangle className={cn(sizeClass, "text-amber-500")} />
      case 'critical':
        return <AlertCircle className={cn(sizeClass, "text-red-500")} />
      default:
        return <Info className={cn(sizeClass, "text-blue-500")} />
    }
  }

  const getRecommendationColor = (type: InsightType) => {
    switch (type) {
      case 'positive':
        return 'text-emerald-600 dark:text-emerald-400'
      case 'warning':
        return 'text-amber-600 dark:text-amber-400'
      case 'critical':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-blue-600 dark:text-blue-400'
    }
  }

  if (activeInsights.length === 0) {
    return null
  }

  return (
    <div className={cn("insights-panel-horizontal", className)}>
      {!showAll && activeInsights.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          >
            Show {activeInsights.length} insights →
          </button>
        </div>
      )}

      {showAll && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
            {visibleInsights.map((insight) => (
              <div
                key={insight.id}
                className={cn(
                  "relative group rounded-lg border p-4 transition-all duration-200",
                  getTypeStyles(insight.type),
                  "hover:shadow-sm"
                )}
              >
                {/* Dismiss button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss(insight.id)
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-500/10 rounded"
                >
                  <X className="w-3.5 h-3.5 theme-text-secondary" />
                </button>

                <div className="flex items-start gap-3 pr-6">
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeIcon(insight.type, 'sm')}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold theme-text-primary mb-1 leading-tight">
                      {insight.title}
                    </h4>
                    
                    <p className="text-xs theme-text-secondary leading-relaxed">
                      {insight.description}
                      {insight.recommendation && (
                        <span className={cn("ml-1 font-medium", getRecommendationColor(insight.type))}>
                          {insight.recommendation}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <button
              onClick={() => setShowAll(false)}
              className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              Hide insights
            </button>
          </div>
        </>
      )}
    </div>
  )
}