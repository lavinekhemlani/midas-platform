// src/components/reports/StatementExportDropdown.tsx
'use client'

/**
 * Statement Export Dropdown Component
 *
 * A dropdown menu for exporting financial statement line items to PDF, CSV, or Markdown.
 * To be placed in the header area of statement tables.
 */

import React, { useState, useCallback } from 'react'
import { Download, FileText, FileSpreadsheet, FileCode, Loader2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  exportStatement,
  preparePDFData,
  type StatementLineItem,
  type ExportMetadata,
  type ExportFormat,
} from '@/lib/utils/statementExport'
// Lazy-loaded at export time to keep @react-pdf out of the client bundle
const getDownloadStatementPDF = () =>
  import('./StatementPDFDocument').then((m) => m.downloadStatementPDF)

// =============================================================================
// Types
// =============================================================================

interface StatementExportDropdownProps {
  /** The statement line items to export */
  data: StatementLineItem[]
  /** Export metadata (title, dates, currency, etc.) */
  metadata: ExportMetadata
  /** Optional custom class name */
  className?: string
  /** Compact mode (smaller button) */
  compact?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function StatementExportDropdown({
  data,
  metadata,
  className,
  compact = false,
}: StatementExportDropdownProps) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null)

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (isExporting) return

      setIsExporting(format)

      try {
        if (format === 'pdf') {
          const pdfData = preparePDFData(data, metadata)
          const filename = generateFilename(metadata, 'pdf')
          const downloadStatementPDF = await getDownloadStatementPDF()
          await downloadStatementPDF(pdfData, filename)
        } else {
          exportStatement(format, data, metadata)
        }
      } catch (error) {
        console.error(`Failed to export as ${format}:`, error)
      } finally {
        setIsExporting(null)
      }
    },
    [data, metadata, isExporting]
  )

  return (
    <DropdownMenu
      align="end"
      trigger={
        <button
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md',
            'text-xs font-medium transition-colors',
            'theme-text-secondary hover:theme-text-primary',
            'hover:bg-amber-500/10',
            'border border-transparent hover:border-amber-500/20',
            compact && 'px-2 py-1',
            className
          )}
          disabled={!!isExporting}
        >
          {isExporting ? (
            <Loader2 className={cn('animate-spin', compact ? 'w-5 h-5' : 'w-6 h-6')} />
          ) : (
            <Download className={cn(compact ? 'w-5 h-5' : 'w-6 h-6')} />
          )}
          {!compact && <span>Export</span>}
        </button>
      }
      className="min-w-[160px]"
    >
      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={() => handleExport('pdf')}
      >
        <FileText className="w-4 h-4 text-red-500" />
        <span>Export as PDF</span>
        {isExporting === 'pdf' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </DropdownMenuItem>

      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={() => handleExport('csv')}
      >
        <FileSpreadsheet className="w-4 h-4 text-green-500" />
        <span>Export as CSV</span>
        {isExporting === 'csv' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </DropdownMenuItem>

      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={() => handleExport('markdown')}
      >
        <FileCode className="w-4 h-4 text-blue-500" />
        <span>Export as Markdown</span>
        {isExporting === 'markdown' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </DropdownMenuItem>
    </DropdownMenu>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate filename for export
 */
function generateFilename(metadata: ExportMetadata, format: ExportFormat): string {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const title = (metadata.title || 'statement').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const date = metadata.asOfDate
    ? formatDate(metadata.asOfDate).replace(/[^a-zA-Z0-9]/g, '-')
    : metadata.dateRange
      ? `${formatDate(metadata.dateRange.start)}-to-${formatDate(metadata.dateRange.end)}`.replace(
          /[^a-zA-Z0-9]/g,
          '-'
        )
      : new Date().toISOString().split('T')[0]

  const extension = format === 'markdown' ? 'md' : format
  return `${title}-${date}.${extension}`
}

export default StatementExportDropdown
