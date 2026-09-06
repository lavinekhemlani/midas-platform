// src/components/settings/SettingsCard.tsx
'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsCardProps {
  title: string
  description?: string
  icon: LucideIcon
  iconColor?: string
  children: React.ReactNode
  defaultExpanded?: boolean
  collapsible?: boolean
  className?: string
}

export default function SettingsCard({
  title,
  description,
  icon: Icon,
  iconColor = 'text-amber-500',
  children,
  defaultExpanded = true,
  collapsible = false,
  className,
}: SettingsCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className={cn('glass-luxury-card rounded-xl min-h-fit', className)}>
      {/* Header */}
      <div
        className={cn(
          'p-4 border-b border-gray-200/10',
          collapsible && 'cursor-pointer hover:bg-white/5 transition-colors'
        )}
        onClick={toggleExpanded}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn('p-2 rounded-lg bg-opacity-10', iconColor)}>
              <Icon className={cn('w-5 h-5', iconColor)} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold theme-text-primary font-[family-name:var(--font-dm-sans)]">
                {title}
              </h3>
              {description && <p className="text-xs theme-text-secondary mt-0.5">{description}</p>}
            </div>
          </div>
          {collapsible && (
            <button
              type="button"
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 theme-text-secondary" />
              ) : (
                <ChevronRight className="w-5 h-5 theme-text-secondary" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && <div className="p-4">{children}</div>}
    </div>
  )
}
