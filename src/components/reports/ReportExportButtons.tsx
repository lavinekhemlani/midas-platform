import React from 'react'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ReportExportButtonsProps {
  onExport: (format: 'pdf' | 'excel') => void | Promise<void>
  isExporting?: boolean
  showExcel?: boolean
  className?: string
}

export function ReportExportButtons({
  onExport,
  isExporting = false,
  showExcel = true,
  className = '',
}: ReportExportButtonsProps) {
  return (
    <div className={`flex items-center gap-2 ml-auto ${className}`}>
      <Button
        onClick={() => onExport('pdf')}
        variant="outline"
        size="sm"
        disabled={isExporting}
        className="group h-8 border-2 border-amber-500/70 dark:border-amber-400/70
                   text-amber-600 dark:text-amber-400
                   bg-transparent
                   hover:border-amber-500 hover:bg-amber-500 hover:text-white
                   dark:hover:border-amber-400 dark:hover:bg-amber-400 dark:hover:text-slate-900
                   focus-visible:ring-2 focus-visible:ring-amber-400/50 active:scale-95
                   disabled:opacity-50 disabled:cursor-not-allowed"
        title={isExporting ? 'Generating PDF...' : 'Download report as PDF'}
        aria-label="Export report as PDF"
      >
        {isExporting ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <FileText className="w-6 h-6 text-current transition-transform group-hover:scale-110" />
        )}
        <span className="text-xs">PDF</span>
      </Button>

      {showExcel && (
        <Button
          onClick={() => onExport('excel')}
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="group h-8 border-2 border-emerald-500/70 dark:border-emerald-400/70
                     text-emerald-600 dark:text-emerald-400
                     bg-transparent
                     hover:border-emerald-500 hover:bg-emerald-500 hover:text-white
                     dark:hover:border-emerald-400 dark:hover:bg-emerald-400 dark:hover:text-slate-900
                     focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export report to Excel"
          aria-label="Export report as Excel spreadsheet"
        >
          <FileSpreadsheet className="w-6 h-6 text-current transition-transform group-hover:scale-110" />
          <span className="text-xs">Excel</span>
        </Button>
      )}
    </div>
  )
}
