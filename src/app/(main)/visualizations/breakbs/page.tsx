'use client'

import { Suspense } from 'react'
import { DrillDownWaterfall } from './components/DrillDownWaterfall'
import { MOCK_DATA } from './mock-data'
import { formatCompactNumber } from '@/components/chat/visualizations/shared'

function BreakBSContent() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Balance Sheet Waterfall</h1>
        <p className="text-muted-foreground mt-1">
          Interactive drill-down visualization for balance sheets with negative equity
        </p>
      </div>

      {/* Mock Data Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-sm text-muted-foreground">Total Assets</div>
          <div className="text-2xl font-bold text-emerald-500">
            ${formatCompactNumber(MOCK_DATA.totalAssets)}
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-sm text-muted-foreground">Total Liabilities</div>
          <div className="text-2xl font-bold text-red-500">
            ${formatCompactNumber(MOCK_DATA.totalLiabilities)}
          </div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-sm text-muted-foreground">Total Equity</div>
          <div className="text-2xl font-bold text-red-500">
            ${formatCompactNumber(MOCK_DATA.totalEquity)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            (Negative - Liabilities exceed Assets)
          </div>
        </div>
      </div>

      {/* Accounting Equation */}
      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <span className="text-sm text-muted-foreground">Accounting Equation: </span>
        <span className="font-mono text-sm">
          Assets (${formatCompactNumber(MOCK_DATA.totalAssets)}) = Liabilities ($
          {formatCompactNumber(MOCK_DATA.totalLiabilities)}) + Equity ($
          {formatCompactNumber(MOCK_DATA.totalEquity)})
        </span>
      </div>

      {/* Waterfall Chart */}
      <div className="bg-card rounded-lg p-6 border">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Drill-Down Waterfall</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Positive bars extend right (green), negative bars extend left (red). Click items with →
            to drill into categories.
          </p>
        </div>
        <DrillDownWaterfall data={MOCK_DATA} />
      </div>
    </div>
  )
}

export default function BreakBSPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BreakBSContent />
    </Suspense>
  )
}
