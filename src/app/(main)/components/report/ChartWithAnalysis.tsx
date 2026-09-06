// src/app/(main)/components/report/ChartWithAnalysis.tsx
'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChartWithAnalysisProps {
  chart: ReactNode
  analysis: string
  className?: string
}

export function ChartWithAnalysis({ 
  chart, 
  analysis, 
  className 
}: ChartWithAnalysisProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Chart */}
      <div className="w-full">
        {chart}
      </div>
      
      {/* Analysis */}
      {analysis && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-1">Analysis</h4>
                <p className="text-sm theme-text-secondary leading-relaxed">
                  {analysis}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}