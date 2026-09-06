// src/app/(main)/reports/components/ReportSidebarCard.tsx
'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReportView } from '@/contexts/ReportsContext'

interface Metric {
  label: string
  value: string
  format?: 'currency' | 'percentage' | 'number'
}

interface ReportSidebarCardProps {
  id: ReportView
  title: string
  description: string
  icon: LucideIcon
  metrics: Metric[]
  isActive: boolean
  isAboveActive?: boolean
  isBelowActive?: boolean
  isFirstCard?: boolean
  isLastCard?: boolean
  onClick: () => void
  onHover?: () => void
}

export function ReportSidebarCard({
  title,
  description,
  icon: Icon,
  metrics,
  isActive,
  isAboveActive,
  isBelowActive,
  isFirstCard,
  isLastCard,
  onClick,
  onHover,
}: ReportSidebarCardProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        // Base styles
        'w-full px-4 py-3 text-left transition-all duration-200',
        'focus:outline-none',
        'flex-1 min-h-0',
        'relative',
        'group',
        'border-r-4 border-t border-l border-b rounded-l-xl',
        isActive
          ? 'border-r-amber-500 border-t-amber-500 border-l-amber-500 border-b-amber-500'
          : 'border-r-transparent border-t-transparent border-l-transparent border-b-transparent'
      )}
      aria-label={`${title} report`}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Icon + Title */}
      <div className={cn(
        'flex items-start gap-3 min-h-0 transition-all',
        isActive ? 'scale-105' : 'group-hover:scale-105'
      )}>
        <Icon className={cn(
          'w-5 h-5 transition-colors flex-shrink-0 mt-0.5',
          isActive ? 'text-amber-400' : 'theme-text-secondary'
        )} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className={cn(
            'font-semibold text-sm leading-tight transition-colors',
            'line-clamp-2',
            isActive ? 'text-amber-400' : 'theme-text-primary'
          )}>
            {title}
          </h3>
          <p className={cn(
            'text-xs leading-tight mt-1 transition-colors',
            'line-clamp-2',
            'theme-text-secondary'
          )}>
            {description}
          </p>
        </div>
      </div>

      {/* Optional Metrics - Only show if provided */}
      {metrics.length > 0 && (
        <>
          <div className="border-t border-gray-200/5 mb-3" />
          <div className="space-y-2">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="flex items-baseline justify-between text-xs gap-2"
              >
                <span className="theme-text-secondary flex-shrink-0">
                  {metric.label}
                </span>
                <span className={cn(
                  'font-medium tabular-nums text-right',
                  isActive ? 'text-amber-300' : 'theme-text-primary'
                )}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </button>
  )
}
