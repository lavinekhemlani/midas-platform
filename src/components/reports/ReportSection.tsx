'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface ReportSectionProps {
  title?: string
  subtitle?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  actions?: ReactNode
}

export function ReportSection({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  actions,
}: ReportSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h2 className="text-2xl font-serif font-light italic theme-text-primary flex items-center gap-2">
                {Icon && <Icon className="w-5 h-5" />}
                {title}
              </h2>
            )}
            {subtitle && <p className="text-sm theme-text-secondary mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
