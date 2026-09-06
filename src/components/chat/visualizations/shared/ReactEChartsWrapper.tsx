/**
 * @component ReactEChartsWrapper
 * @description Centralized ECharts wrapper with loading state
 * All chart components should import from here instead of directly from echarts-for-react
 */

'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

// Loading skeleton for charts
export function ChartLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-64 flex items-center justify-center bg-white/5 rounded-lg animate-pulse',
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400">Loading chart...</span>
      </div>
    </div>
  )
}

// Centralized dynamic import with loading state
export const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <ChartLoadingSkeleton />,
})
