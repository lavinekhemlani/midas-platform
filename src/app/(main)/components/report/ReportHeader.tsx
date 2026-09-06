// src/app/(main)/components/report/ReportHeader.tsx
'use client'

import { Calendar, Building2, FileText, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PIIText } from '@/components/ui/PIIText'

interface ReportHeaderProps {
  title: string
  companyName: string
  dateRange?: string
  reportType?: 'financial' | 'cashflow' | 'comprehensive' | 'custom'
  generatedAt?: Date
  className?: string
}

export function ReportHeader({
  title,
  companyName,
  dateRange,
  reportType = 'comprehensive',
  generatedAt = new Date(),
  className,
}: ReportHeaderProps) {
  const getReportTypeBadge = () => {
    switch (reportType) {
      case 'financial':
        return {
          label: 'Financial Report',
          color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        }
      case 'cashflow':
        return {
          label: 'Cash Flow Report',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        }
      case 'comprehensive':
        return {
          label: 'Comprehensive Report',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        }
      default:
        return {
          label: 'Custom Report',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        }
    }
  }

  const reportBadge = getReportTypeBadge()

  return (
    <header
      className={cn(
        'report-header glass-luxury-card p-6 mb-8',
        'border border-amber-500/20',
        'animate-fade-in-up',
        className
      )}
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl md:text-3xl font-bold theme-text-primary">{title}</h1>
            <Badge variant="outline" className={cn('text-xs', reportBadge.color)}>
              {reportBadge.label}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm theme-text-secondary">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500/60" />
              <PIIText className="font-medium">{companyName}</PIIText>
            </div>

            {dateRange && (
              <>
                <span className="text-amber-500/40">•</span>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500/60" />
                  <span>{dateRange}</span>
                </div>
              </>
            )}

            <span className="text-amber-500/40">•</span>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500/60" />
              <span>
                Generated{' '}
                {generatedAt.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 glass-luxury-card px-3 py-2 rounded-lg border border-emerald-500/20">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Live Data</span>
        </div>
      </div>
    </header>
  )
}
