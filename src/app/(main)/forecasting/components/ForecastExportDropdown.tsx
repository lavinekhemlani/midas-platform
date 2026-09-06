'use client'

import React, { useState, useCallback } from 'react'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ForecastData, ForecastAssumptions } from '@/types/forecasting'
import { exportForecastToCSV } from '@/lib/utils/forecastExport'

interface ForecastExportDropdownProps {
  forecastData: ForecastData
  assumptions: ForecastAssumptions
  className?: string
}

type ExportType = 'pdf' | 'csv'

export function ForecastExportDropdown({
  forecastData,
  assumptions,
  className,
}: ForecastExportDropdownProps) {
  const [isExporting, setIsExporting] = useState<ExportType | null>(null)

  const handleCSVExport = useCallback(() => {
    if (isExporting) return
    setIsExporting('csv')
    try {
      exportForecastToCSV(forecastData)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setIsExporting(null)
    }
  }, [forecastData, isExporting])

  const handlePDFExport = useCallback(async () => {
    if (isExporting) return
    setIsExporting('pdf')
    try {
      // Determine which horizon we need to fetch
      const currentHorizon = forecastData.horizon
      const otherHorizon = currentHorizon === '13-week' ? '6-month' : '13-week'

      // Build URL for the other horizon
      const params = new URLSearchParams({
        horizon: otherHorizon,
        growthRate: String(assumptions.growthRate),
        inflowGrowthRate: String(assumptions.inflowGrowthRate),
        outflowGrowthRate: String(assumptions.outflowGrowthRate),
        rollingAverageDays: String(assumptions.rollingAverageDays),
        confidenceLevel: String(assumptions.confidenceLevel),
      })

      const res = await fetch(`/api/forecasting?${params}`)
      const json = await res.json()

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to fetch other horizon data')
      }

      const otherData: ForecastData = json.data

      // Determine which is 13-week and which is 6-month
      const data13 = currentHorizon === '13-week' ? forecastData : otherData
      const data6 = currentHorizon === '6-month' ? forecastData : otherData

      // Dynamic import to keep bundle size down
      const { ForecastPdfExporter } = await import('@/lib/pdf/forecastPdfExporter')
      await ForecastPdfExporter.export(data13, data6)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setIsExporting(null)
    }
  }, [forecastData, assumptions, isExporting])

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
            className
          )}
          disabled={!!isExporting}
        >
          {isExporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
        </button>
      }
      className="min-w-[160px]"
    >
      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={handlePDFExport}
      >
        <FileText className="w-4 h-4 text-red-500" />
        <span>Export as PDF</span>
        {isExporting === 'pdf' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </DropdownMenuItem>

      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={handleCSVExport}
      >
        <FileSpreadsheet className="w-4 h-4 text-green-500" />
        <span>Export as CSV</span>
        {isExporting === 'csv' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </DropdownMenuItem>
    </DropdownMenu>
  )
}
