// src/components/quickbooks/shared/BaseCard.tsx
'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { QuickBooksComponentProps } from './types'

interface BaseCardProps extends QuickBooksComponentProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
  noPadding?: boolean
}

export function BaseCard({
  children,
  className,
  title,
  subtitle,
  headerAction,
  noPadding = false,
  exportable = true,
  printOptimized = false,
  theme,
  ...props
}: BaseCardProps) {
  return (
    <div
      className={cn(
        // Base styles
        'glass-luxury-card rounded-xl relative overflow-hidden',
        'transition-all duration-200',
        'quickbooks-card',

        // Theme-specific styles
        theme === 'light' && 'bg-white/95 border-gray-200',
        theme === 'dark' && 'bg-black/90 border-amber-500/10',
        theme === 'dark' && 'bg-slate-800/50 border-slate-700/50',

        // Print optimization
        printOptimized && [
          'print:bg-white print:border-gray-300',
          'print:break-inside-avoid',
          'print:shadow-none',
        ],

        // Exportable marker for PDF generation
        exportable && 'pdf-exportable',

        className
      )}
      data-component="quickbooks-base-card"
      {...props}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-xl pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {(title || subtitle || headerAction) && (
          <div className={cn('flex items-start justify-between', !noPadding && 'p-6 pb-4')}>
            <div>
              {title && <h3 className="text-lg font-bold theme-text-primary">{title}</h3>}
              {subtitle && <p className="text-sm theme-text-secondary mt-1">{subtitle}</p>}
            </div>
            {headerAction && <div className="ml-4 flex-shrink-0">{headerAction}</div>}
          </div>
        )}

        <div className={cn(!noPadding && (title ? 'px-6 pb-6' : 'p-6'))}>{children}</div>
      </div>
    </div>
  )
}
