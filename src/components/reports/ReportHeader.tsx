'use client'

import { Calendar, Building2, FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ReportHeaderProps {
  title: string
  subtitle?: string
  organizationName?: string
  dateRange?: {
    start: string
    end: string
  }
  reportType?: string
  actions?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
    variant?: 'default' | 'outline' | 'ghost'
  }[]
  className?: string
}

export function ReportHeader({
  title,
  subtitle,
  organizationName,
  dateRange,
  reportType,
  actions,
  className
}: ReportHeaderProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className={cn(
      'pb-6 mb-6',
      className
    )}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold theme-text-primary mb-2">
            {title}
          </h1>

          {subtitle && (
            <p className="text-lg theme-text-secondary mb-3">
              {subtitle}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm theme-text-secondary">
            {organizationName && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>{organizationName}</span>
              </div>
            )}

            {dateRange && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                </span>
              </div>
            )}

            {reportType && (
              <Badge variant="secondary" className="text-xs">
                {reportType}
              </Badge>
            )}
          </div>
        </div>

        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={action.onClick}
                className="flex items-center gap-2"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}